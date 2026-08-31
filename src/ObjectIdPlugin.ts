/**
 * @license MIT
 * @copyright Copyright 2025 Modus Operandi Inc. All Rights Reserved.
 */

import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  Transaction,
} from 'prosemirror-state';
import { SetDocAttrStep } from '@modusoperandi/licit-doc-attrs-step';
import { findParentNodeClosestToPos } from 'prosemirror-utils';
import { createObjectId } from './create-object-id';
import { EditorView } from 'prosemirror-view';
import {
  Schema,
  Node,
  NodeSpec,
  Slice,
  AttributeSpec,
  NodeType,
  Node as ProseMirrorNode
  Fragment,
} from 'prosemirror-model';
const SPEC = 'spec';
const ATTR_OBJID = 'objectId';
const ATTR_OBJMETADATA = 'objectMetaData';
const ATTR_DIRTY = 'dirty';
const ATTR_SELECTIONID = 'selectionId';
const NEWATTRS = [ATTR_OBJID, ATTR_OBJMETADATA, ATTR_DIRTY, ATTR_SELECTIONID];
const ENTERKEYCODE = 13;
const BACKSPACEKEYCODE = 8;
const ATTR_DELETEDOBJIDS = 'deletedObjectIds';

// Nodes that must NOT receive an objectId attribute.
// - 'text': ProseMirror throws at schema compilation if text nodes have attrs.
// - 'hard_break': inline leaf with no meaningful artifact identity.
const BLACKLISTED_NODES = new Set(['text', 'hard_break']);

interface IdConfig {
  prefix?: string;
  suffix?: string;
  cutObjectIds?: CutObjectInfo[];
}

interface CutObjectInfo {
  objectId: string;
  objectMetaData: Record<string, unknown>;
  selectionId: string;
}

export interface Ranges {
  from: number;
  to: number;
}
type FindParentNodeResult = {
  pos: number;
  start: number;
  depth: number;
  node: ProseMirrorNode;
};

export const ObjectIdPluginKey = new PluginKey('ObjectIdPlugin');

export class ObjectIdPlugin extends Plugin<IdConfig> {
  loaded: boolean;
  isCut: boolean;
  pastedPara: Slice;
  view: EditorView;
  namespacePlugin: Plugin;
  suffix: string;
  constructor(objectConfig: IdConfig = {}) {
    super({
      key: ObjectIdPluginKey,
      state: {
        init(_config, _state) {
          return { loaded: false, cutObjectIds: [], ...objectConfig };
        },
        apply(_tr, _set, state) {
          return { ...state, ..._set };
        },
      },
      props: {
        handleDOMEvents: {
          keydown(view: EditorView, _event: KeyboardEvent) {
            (this as ObjectIdPlugin).view = view;
            return false;
          },
          cut: (view: EditorView, _event) => {
            this.isCut = true;
            const { state } = view;
            const { selection } = state;
            const { from, to } = selection;
            const frompos = Math.max(from - 1, 0);
            const selectedPara = state.doc.slice(frompos, to);
            selectedPara.content.forEach((node) => {
              if (!this.isNodeBlacklisted(node) && node.attrs[ATTR_OBJID]) {
                this.getState(view.state)?.cutObjectIds.push({
                  objectId: node.attrs[ATTR_OBJID],
                  objectMetaData: node.attrs[ATTR_OBJMETADATA],
                  selectionId: node.attrs[ATTR_SELECTIONID],
                });
              }
            });
          },
        },

        handlePaste(view, _event, slice) {
          const { cutObjectIds } = this.getState(view.state) || {};
          if (cutObjectIds?.length > 0) {
            // First paste after a cut — this is a "move": preserve the
            // original objectIds. cutObjectIds is fully cleared in
            // appendTransaction after the paste, so any subsequent paste
            // falls through to the copy+paste branch below and gets new IDs.
            (this as ObjectIdPlugin).pastedPara = slice;
            let tr = view.state.tr;
            const { selection } = view.state;
            const { from } = selection;
            // Resolve the block node that contains the paste cursor.
            // The previous `nodeAt(from - 1)` assumed the cursor sat at the
            // very start of a top-level paragraph, so `from - 1` resolved to
            // the paragraph. When the cursor is mid-text (e.g. inside a
            // table cell) `from - 1` resolves to a *text* node, and
            // `setNodeMarkup` then calls `NodeType.create` with the text
            // type, throwing `NodeType.create can't construct text nodes`.
            // Walk up from the cursor to find the closest ancestor that
            // carries an objectId attribute and is not a text node.
            const $from = selection.$from;
            const hasResolvedPos =
              $from &&
              typeof $from.depth === 'number' &&
              typeof $from.node === 'function';
            const parent = hasResolvedPos
              ? findParentNodeClosestToPos(
                  $from,
                  (node: Node) =>
                    !node.isText && !!node.attrs && ATTR_OBJID in node.attrs
                )
              : { node: tr.doc.nodeAt(from - 1), pos: from - 1 };
            if (!parent?.node) {
              // No suitable target block; let ProseMirror perform the
              // default paste instead of crashing.
              return false;
            }
            const node = parent.node;
            const pos = parent.pos;
            const newattrs = { ...node.attrs };
            const index = cutObjectIds.findIndex(
              (obj) => obj.objectId === node.attrs?.objectId
            );
            newattrs.objectMetaData = cutObjectIds[0].objectMetaData;
            if (index >= 0) {
              newattrs.objectId = node.attrs.objectId;
              this.getState(view.state).cutObjectIds.splice(index, 1);
            } else {
              newattrs.objectId = cutObjectIds[0].objectId;
              this.getState(view.state).cutObjectIds.shift();
            }
            // Set the objectId on the target paragraph BEFORE inserting
            // the pasted content. setNodeMarkup only changes attrs (no
            // position shift), so the selection is still valid for
            // replaceSelection below.
            tr = tr.setNodeMarkup(pos, undefined, newattrs);
            // Insert the pasted content into the SAME transaction so that
            // the objectId assignment and the paste are a single undo
            // step. Previously these were two separate dispatches (the
            // plugin's setNodeMarkup, then ProseMirror's default
            // replaceSelection), which created two history entries per
            // paste and broke undo.
            tr = tr.replaceSelection(slice);
            // Do NOT set skipAppendTransaction — appendTransaction must
            // run to handle assignSameObjectMetaDataForCutPastePara (for
            // multi-paragraph pastes) and other post-paste bookkeeping.
            view.dispatch(tr);
            // Return true so ProseMirror does NOT also perform the default
            // paste (we already inserted the content above).
            return true;
          }
          // Copy+paste, or a second paste after cut (cutObjectIds was
          // cleared in appendTransaction after the first paste). The
          // pasted content carries objectIds from the source; assign new
          // IDs to every node so they don't duplicate existing IDs in the
          // document. This replaces the previous expensive full-document
          // duplicate scan (isObjectIdDuplicate) that could also change
          // the original paragraph's ID.
          const newSlice = (this as ObjectIdPlugin).assignNewIdsToSlice(slice, view);
          if (newSlice !== slice) {
            const tr = view.state.tr.replaceSelection(newSlice);
            view.dispatch(tr);
            return true;
          }
          return false;
        },
      },

      appendTransaction: (transactions: Transaction[], prevState: EditorState, nextState: EditorState) => {
        let tr: Transaction = null;

        //  Skip recursion for plugin-generated transactions
        if (this.shouldSkipAppend(transactions)) {
          return null;
        }
        // Detect document has any changes
        const docChanged = this.isDocChanged(transactions);
        if (!docChanged && this.loaded) {
          return null;
        }

        const capcoPos = transactions.find(t => t.getMeta("capcoChangedPos"))?.getMeta("capcoChangedPos");

        // Separate undo/redo from regular transactions
        const undoRedoTransactions = transactions.filter(t =>
          t.getMeta('history')?.undo || t.getMeta('history')?.redo
        );
        const regularTransactions = transactions.filter(t =>
          !t.getMeta('history')?.undo && !t.getMeta('history')?.redo
        );

        if (undoRedoTransactions.length > 0) {
          tr = this.handleUndoRedo(prevState, nextState, tr, docChanged, capcoPos);
        }
        if (regularTransactions.length > 0 && (!this.loaded || docChanged)) {
          this.loaded = true;
          tr = this.assignIDsForMissing(regularTransactions, prevState, nextState, this.view);

          if (this.pastedPara?.content?.childCount > 1) {
            tr = this.assignSameObjectMetaDataForCutPastePara(nextState, tr);
          }
          // Always clear cutObjectIds and pastedPara after a paste,
          // regardless of whether all entries were matched above. This
          // ensures the next paste does not take the cut+paste "move"
          // branch (which would duplicate objectIds).
          if (this.pastedPara) {
            const st = this.getState(nextState);
            if (st) st.cutObjectIds = [];
            this.pastedPara = null;
          }

          tr = this.trackDeletedObjectId(prevState, nextState, tr);
          tr = this.setDirtyFlagOnChange(prevState, nextState, tr, docChanged, capcoPos);
          tr = this.markDirtyByChangedRanges(regularTransactions, prevState, nextState, tr);
        }
        if (tr && nextState.tr) {
          tr.storedMarks = nextState.tr.storedMarks;
        }

        if (tr?.docChanged) {
          tr.setMeta('skipAppendTransaction', true);
          return tr;
        }
        return null;
      },

    });
  }

  /**
   * Checks if a node has an attribute.
   *
   * @param node the node to check
   * @param attrName the attribute name to check for
   * @return true if node has the attribute, false otherwise
   */
  isNodeHasAttribute = (node: Node, attrName: string): boolean => {
    const val = node.attrs?.[attrName];
    return val !== undefined && val !== null;
  };

  isNodeBlacklisted = (node: Node): boolean => {
    return BLACKLISTED_NODES.has(node.type.name);
  };

  requiredAddAttr = (node: Node): boolean => {
    return (
      !this.isNodeBlacklisted(node) &&
      !this.isNodeHasAttribute(node, ATTR_OBJID)
    );
  };

  getEffectiveSchema(schema: Schema): Schema {
    return this.applyEffectiveSchema(schema);
  }

  isDocChanged(transactions: Transaction[]): boolean {
    return transactions.some((transaction) => {
      return transaction.docChanged && !transaction.getMeta('styleInitialLoad');
    });
  }

  getObjectMetaDataFromCutObj(objectId: string, cutObjectIds: CutObjectInfo[]) {
    const found = cutObjectIds.find((obj) => obj.objectId === objectId);
    return found?.objectMetaData;
  }

  assignSameObjectMetaDataForCutPastePara(
    nextState: EditorState,
    tr: Transaction
  ): Transaction | null {
    let trans = tr || nextState.tr;
    const { cutObjectIds } = this.getState(nextState) || {};
    // this is a cut and paste paras, need to set the objectMetaData same when user cut and paste multiple paragraphs
    if (this.pastedPara?.content?.childCount > 1) {
      nextState.doc.descendants((node, pos) => {
        //check if the para is a cut and paste para
        if (
          !this.isNodeBlacklisted(node) &&
          null === node.attrs.objectMetaData &&
          cutObjectIds.some(
            (objId) => objId.objectId === node.attrs[ATTR_OBJID]
          )
        ) {
          const newattrs = { ...node.attrs };
          newattrs.objectMetaData = this.getObjectMetaDataFromCutObj(
            newattrs.objectId,
            cutObjectIds
          );
          trans = trans.setNodeMarkup(pos, undefined, newattrs);
        }
      });
    }
    return trans;
  }

  getChangedRanges(transactions): Ranges[] {
    const ranges: Ranges[] = [];
    for (const tr of transactions) {
      tr.mapping.maps.forEach(map => {
        map.forEach((newStart, newEnd) => {
          ranges.push({ from: newStart, to: newEnd });
        });
      });
    }
    return ranges;
  }

  handleUndoRedo(
    prevState: EditorState,
    nextState: EditorState,
    tr: Transaction | null,
    docChanged: boolean,
    capcoPos: number
  ): Transaction | null {
    tr = this.trackDeletedObjectId(prevState, nextState, tr);
    tr = this.setDirtyFlagOnChange(prevState, nextState, tr, docChanged, capcoPos);
    if (tr && nextState.tr) tr.storedMarks = nextState.tr.storedMarks;
    return tr;
  }
  assignIDsForMissing(
    transactions: Transaction[],
    prevState: EditorState,
    nextState: EditorState,
    view: EditorView
  ): Transaction | null {
    let tr = nextState.tr;
    let modified = false;
    const objIds = [];
    const rangePos = [];
    const { prefix, suffix } = this.getState(nextState) || {};

    // Adds a unique id to the document
    if (this.requiredAddAttr(nextState.doc)) {
      tr = tr.step(
        new SetDocAttrStep(ATTR_OBJID, createObjectId(prefix, suffix))
      );
      if (!this.isNodeHasAttribute(nextState.doc, ATTR_OBJMETADATA)) {
        tr = tr.step(new SetDocAttrStep(ATTR_OBJMETADATA, null));
      }
      modified = true;
    }

    const rawRanges = this.getChangedRanges(transactions);
    const changedRanges = this.mergeRanges(rawRanges);
    const docSize = nextState.doc.content.size;

    // Only process affected parts
    // let tr = nextState.tr;
    for (const range of changedRanges) {
      //  Defensive bounds check
      const from = Math.max(0, Math.min(range.from, docSize));
      const to = Math.max(0, Math.min(range.to, docSize));
      if (from >= to) continue;

      try {
        nextState.doc.nodesBetween(from, to, (node, pos) => {
          if (!rangePos.includes(pos)) {
            rangePos.push(pos);
            const required = this.isRequiredNewId(
              node,
              objIds,
              view,
              prevState,
              nextState,
              pos
            );
            if (!this.isNodeBlacklisted(node) && required && node !== nextState.doc) {
              const newId = createObjectId(prefix, suffix);
              objIds.push(newId)
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, [ATTR_OBJID]: newId });
              modified = true;
            }
          }
        });
      } catch (err) {
        console.warn("Skipped invalid range in assignIDsForMissing:", range, err);
      }
    }

    return modified ? tr : null;
  }

  mergeRanges(ranges: Ranges[]): Ranges[] {
    if (!ranges.length) return [];
    ranges.sort((a, b) => a.from - b.from);
    const merged = [ranges[0]];

    for (let i = 1; i < ranges.length; i++) {
      const last = merged.at(-1);
      const current = ranges[i];
      if (current.from <= last.to + 1) {
        last.to = Math.max(last.to, current.to);
      } else {
        merged.push(current);
      }
    }
    return merged;
  }

  shouldSkipAppend(transactions: Transaction[]): boolean {
    return transactions.some(tr => tr.getMeta('skipAppendTransaction'));
  }

  isUndoOrRedo(transactions: Transaction[]): boolean {
    return transactions.some(tr => tr.getMeta('history')?.undo || tr.getMeta('history')?.redo);
  }


  isRequiredNewId(
    node: Node,
    objIds: string[],
    view: EditorView,
    prevState: EditorState,
    nextState: EditorState,
    pos: number
  ): boolean {
    let required = false;
    if (this.requiredAddAttr(node)) {
      required = true;
    } else {
      const objId = node.attrs[ATTR_OBJID];
      if (objIds.includes(objId) && view?.['input']?.['lastKeyCode'] !== BACKSPACEKEYCODE) {
        // objectId already exists, recreate
        required = true;
      } else {
        required = this.createNewId(
          node,
          objId,
          objIds,
          view,
          prevState,
          nextState,
          pos
        );
      }
    }

    return required;
  }

  createNewId(
    _node: Node,
    objId: string,
    objIds: string[],
    view: EditorView,
    prevState: EditorState,
    nextState: EditorState,
    pos: number
  ): boolean {
    let required = false;
    // create new id for first para on enter key press from the begining of a document
    if (objId && view) {
      if (this.isNewParagraph(prevState, nextState, pos, view)) {
        required = true;
      } else {
        objIds.push(objId);
      }
    }

    return required;
  }

  /**
   * Walks the pasted slice and assigns a fresh objectId to every node
   * that carries one. Used for copy+paste (and second paste after cut)
   * so that pasted content never duplicates an objectId already present
   * in the document. This replaces the previous full-document
   * `isObjectIdDuplicate` scan, which was expensive and could change the
   * original paragraph's ID.
   *
   * Returns the original slice unchanged if no node had an objectId (or
   * if the slice is not a real ProseMirror Slice), so that callers can
   * detect "nothing to do" and let ProseMirror perform the default paste.
   */
  assignNewIdsToSlice(slice: Slice, view: EditorView): Slice {
    if (!slice?.content || typeof slice.content.forEach !== 'function') {
      return slice;
    }
    const { prefix, suffix } = this.getState(view.state) || {};
    const newContent = this.assignNewIdsToFragment(slice.content, prefix, suffix);
    if (newContent === slice.content) return slice;
    return new Slice(newContent, slice.openStart, slice.openEnd);
  }

  private assignNewIdsToFragment(
    fragment: Fragment,
    prefix?: string,
    suffix?: string
  ): Fragment {
    if (!fragment || typeof fragment.forEach !== 'function') {
      return fragment;
    }
    const children: Node[] = [];
    let modified = false;
    fragment.forEach((node: Node) => {
      if (this.isNodeBlacklisted(node)) {
        children.push(node);
        return;
      }
      // Recurse into children first.
      const newChildContent =
        node.content && node.content.size > 0
          ? this.assignNewIdsToFragment(node.content, prefix, suffix)
          : node.content;

      if (node.attrs && ATTR_OBJID in node.attrs && !node.isText) {
        const newId = createObjectId(prefix, suffix);
        try {
          children.push(
            node.type.create(
              { ...node.attrs, [ATTR_OBJID]: newId },
              newChildContent,
              node.marks
            )
          );
          modified = true;
        } catch {
          // If create fails for any reason, keep the original node
          // (with recursed content if that changed).
          children.push(
            newChildContent !== node.content ? node.copy(newChildContent) : node
          );
        }
      } else if (newChildContent !== node.content) {
        children.push(node.copy(newChildContent));
        modified = true;
      } else {
        children.push(node);
      }
    });
    return modified ? Fragment.from(children) : fragment;
  }

  nodeAssignment(state: EditorState): Record<string, unknown> {
    const nodesById = {};
    state.doc.descendants((node) => {
      if (!this.isNodeBlacklisted(node) && node.attrs.objectId) {
        nodesById[node.attrs.objectId] = node;
      }
    });

    return nodesById;
  }

  /**
   * Update the list of deleted Object Id's.
   *
   * @param {*} prevState document state before change.
   * @param {*} nextState document state after change.
   * @param {*} tr current transaction if any.
   */
  trackDeletedObjectId(
    prevState: EditorState,
    nextState: EditorState,
    tr: Transaction
  ): Transaction {
    if (prevState.doc !== nextState.doc) {
      // Find id's in old document state that are not in the new.
      const deletedIds = new Set();
      const prevNodesById = this.nodeAssignment(prevState);
      const nextNodesById = this.nodeAssignment(nextState);
      Object.keys(prevNodesById)
        .filter((id) => nextNodesById[id] === undefined)
        .forEach((id) => deletedIds.add(id));

      if (0 < deletedIds.size) {
        // New deleted items have been found.
        // Add any previously deleted items to the set to prevent the same id from
        // appearing in the list multiple times.
        const existingIds = nextState.doc.attrs[ATTR_DELETEDOBJIDS] ?? [];
        existingIds.forEach((id: string) => deletedIds.add(id));

        // Build step to change document.
        const step = new SetDocAttrStep(
          ATTR_DELETEDOBJIDS,
          Array.from(deletedIds)
        );

        // Create updated transaction to apply the change.
        tr = (tr || nextState.tr).step(step);
      }
    }
    return tr;
  }

  createNewAttributes(schema: Schema): void {
    schema.spec.nodes.forEach((name: string, spec: NodeSpec) => {
      if (BLACKLISTED_NODES.has(name)) return;
      // Add attrs to both the NodeSpec and the NodeType. The NodeType's
      // computed attrs are what computeAttrs uses at runtime; the spec is
      // needed for future schema recompilation.
      const nodeType = schema.nodes[name];
      NEWATTRS.forEach((attr) => {
        this.createAttribute(spec, attr, null);
        if (nodeType) {
          this.createAttribute(nodeType, attr, null);
        }
      });
    });
  }

  applyEffectiveSchema(schema: Schema): Schema {
    if (schema?.[SPEC]) {
      this.createNewAttributes(schema);
    }

    return schema;
  }

  createAttribute(
    content: NodeSpec,
    key: string,
    value: string | number | null
  ): void {
    content.attrs ??= {};
    content.attrs[key] ??= {
      default: value,
      hasDefault: true, // Attribute2 expects this despite not being in the schema
      validate: validateAttr,
    } as AttributeSpec;
  }

  // checks enter key applied from begining of a paragraph
  isNewParagraph(
    prevState: EditorState,
    _nextState: EditorState,
    pos: number,
    view: EditorView
  ): boolean {
    let bOk = false;
    if (
      ENTERKEYCODE === view?.['input']?.['lastKeyCode'] &&
      prevState.selection.$from.pos === prevState.selection.$from.start() &&
      pos === prevState.selection.from - 1
    ) {
      bOk = true;
    }
    return bOk;
  }

  private getParentBySelection(doc: Node, sel: TextSelection, type: NodeType) {
    const pos = sel.$cursor ? sel.$cursor.pos : sel.$to.pos;
    return findParentNodeClosestToPos(
      doc.resolve(pos),
      (node) => node.type === type
    );
  }

  private getParentByPosition(doc: Node, pos: number, type: NodeType) {
    return findParentNodeClosestToPos(
      doc.resolve(pos),
      (node) => node.type === type
    );
  }


  private normalizeNodeForDirtyCompare(node: Node | null | undefined) {
    if (!node) {
      return null;
    }
    const json = typeof node.toJSON === 'function' ? node.toJSON() : node;
    const walk = (value: unknown): unknown => {
      if (!value || typeof value !== 'object') {
        return value;
      }
      if (Array.isArray(value)) {
        return value.map(walk);
      }
      const next: Record<string, unknown> = {};
      Object.keys(value).forEach((key) => {
        if (key === 'dirty') {
          return;
        }
        next[key] = walk((value as Record<string, unknown>)[key]);
      });
      return next;
    };
    return walk(json);
  }

  private didNodeChange(prevNode: Node | null | undefined, nextNode: Node | null | undefined): boolean {
    return JSON.stringify(this.normalizeNodeForDirtyCompare(prevNode)) !==
      JSON.stringify(this.normalizeNodeForDirtyCompare(nextNode));
  }

  // set the dirty flag on each changes on editor and also for undo operations.
  setDirtyFlagOnChange(
    prevState: EditorState,
    nextState: EditorState,
    tr: Transaction,
    docChanged: boolean,
    capcoPos: number | number[] | null
  ): Transaction {
    let isDirty = false;
    let isOnLoad = false;
    const { selection, schema } = nextState;
    if (
      !(
        selection instanceof TextSelection &&
        prevState.selection instanceof TextSelection
      )
    ) {
      return tr;
    }
    if (capcoPos != null) {
      tr = this.setDirtyFlagOnChangeForParagraph(
        prevState,
        nextState,
        tr,
        docChanged,
        capcoPos
      );
    } else {
      let para: FindParentNodeResult | null = null;
      let para1: FindParentNodeResult | null = null;
      para = this.getParentBySelection(
        nextState.doc,
        selection,
        schema.nodes.paragraph
      );
      para1 = this.getParentBySelection(
        prevState.doc,
        prevState.selection,
        schema.nodes.paragraph

      );

      if (tr) {
        let para2: FindParentNodeResult | null = null;
        const curSelection = tr['curSelection'];
        if (curSelection) {
          para2 = this.getParentBySelection(
            tr.doc,
            curSelection,
            schema.nodes.paragraph

          );
        }
        isDirty = !!para2?.node.attrs.dirty;
      }

      if (!isDirty) {
        isDirty = !!para1?.node.attrs.dirty;
      }
      if (para && para1) {
        // on document load the last paragraph becomes dirty, to avoid that we check the position between the two paragraphs
        isOnLoad = para.pos - para1.pos > 3;
      }
      tr = this.setDirtyFlagOnChangeForTableParagraph(
        nextState,
        tr,
        docChanged,
        isDirty,
        isOnLoad,
        para,
        para1
      );
    }
    return tr;
  }

  setDirtyFlagOnChangeForParagraph(
    prevState: EditorState,
    nextState: EditorState,
    tr: Transaction,
    docChanged: boolean,
    capcoPos: number | number[] | null
  ): Transaction {
    const capcoPositions = Array.isArray(capcoPos) ? capcoPos : [capcoPos];
    let para = null;
    let para1 = null;
    capcoPositions.forEach((pos) => {
      para = nextState.doc.nodeAt(pos);
      para1 = prevState.doc.nodeAt(pos);
      if (para) {
        const isDirty = !!para1?.attrs.dirty;
        const didChange = this.didNodeChange(para1, para);
        if (
          docChanged &&
          didChange &&
          !isDirty &&
          !para.attrs.dirty
        ) {
          tr ??= nextState.tr;
          const currentAttrs = tr.docChanged
            ? (tr.doc.nodeAt(pos)?.attrs ?? para.attrs)
            : para.attrs;
          tr = tr.setNodeMarkup(pos, null, {
            ...currentAttrs,
            dirty: true,
          });
        }
      }
    });
    return tr;
  }

  setDirtyFlagOnChangeForTableParagraph(
    nextState: EditorState,
    tr: Transaction,
    docChanged: boolean,
    isDirty: boolean,
    isOnLoad: boolean,
    para: FindParentNodeResult | null,
    para1: FindParentNodeResult | null
  ): Transaction {
    const { schema } = nextState;
    const didChange = this.didNodeChange(para1?.node, para?.node);
    if (
      para &&
      docChanged &&
      didChange &&
      !isOnLoad &&
      !isDirty &&
      !para.node.attrs.dirty
    ) {
      tr ??= nextState.tr;
      const currentParaAttrs = tr.docChanged
        ? (tr.doc.nodeAt(para.pos)?.attrs ?? para.node.attrs)
        : para.node.attrs;
      tr = tr.setNodeMarkup(para.pos, null, {
        ...currentParaAttrs,
        dirty: true,
      });
    }
    if (para) {
      const parentTable = this.getParentByPosition(
        nextState.doc,
        para.pos,
        schema.nodes.table
      );
      const parentEic = this.getParentByPosition(
        nextState.doc,
        para.pos,
        schema.nodes.enhanced_table_figure
      );
      if (parentTable && docChanged && !parentTable.node.attrs.dirty) {
        tr ??= nextState.tr;
        const currentTableAttrs = tr.docChanged
          ? (tr.doc.nodeAt(parentTable.pos)?.attrs ?? parentTable.node.attrs)
          : parentTable.node.attrs;
        tr = tr.setNodeMarkup(parentTable.pos, null, {
          ...currentTableAttrs,
          dirty: true,
        });
      }
      if (parentEic && docChanged && !parentEic.node.attrs.dirty) {
        tr ??= nextState.tr;
        const currentEicAttrs = tr.docChanged
          ? (tr.doc.nodeAt(parentEic.pos)?.attrs ?? parentEic.node.attrs)
          : parentEic.node.attrs;
        tr = tr.setNodeMarkup(parentEic.pos, null, {
          ...currentEicAttrs,
          dirty: true,
        });
      }
    }
    return tr;
  }

  /**
   * Marks paragraphs dirty based on the transaction's changed ranges.
   * Unlike setDirtyFlagOnChange (which only looks at the selection's
   * paragraph), this method examines every paragraph that falls within
   * a changed range and marks it dirty if its content actually changed.
   * This handles drag-and-drop where both the source paragraph (text
   * removed) and the destination paragraph (text inserted) need to be
   * marked dirty, but the selection only ends up in the destination.
   */
  markDirtyByChangedRanges(
    transactions: Transaction[],
    prevState: EditorState,
    nextState: EditorState,
    tr: Transaction | null
  ): Transaction | null {
    if (!transactions.length) return tr;
    // Guard against transactions without a valid mapping (e.g. fake
    // transactions in tests).
    if (!transactions.every((t) => t?.mapping?.maps)) return tr;

    const { schema } = nextState;
    const paraType = schema.nodes.paragraph;
    if (!paraType) return tr;

    const rawRanges = this.getChangedRanges(transactions);
    const changedRanges = this.mergeRanges(rawRanges);
    const docSize = nextState.doc.content.size;
    const markedPositions = new Set<number>();

    for (const range of changedRanges) {
      const from = Math.max(0, Math.min(range.from, docSize));
      const to = Math.max(0, Math.min(range.to, docSize));
      if (from >= to) continue;

      // Find all paragraphs in the changed range of nextState.doc
      nextState.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type !== paraType) return;
        if (markedPositions.has(pos)) return;

        // Map the position back to prevState.doc to find the
        // corresponding paragraph (if any) for comparison.
        const prevPos = this.mapPosBackward(transactions, pos);
        const prevPara =
          prevPos != null ? prevState.doc.nodeAt(prevPos) : null;
        const nextPara = nextState.doc.nodeAt(pos);

        // Mark dirty if the paragraph content actually changed
        const didChange = this.didNodeChange(prevPara, nextPara);
        if (!didChange) return;

        // Skip if already dirty
        if (nextPara.attrs?.dirty) return;

        markedPositions.add(pos);
        tr ??= nextState.tr;
        // Read current attrs from tr.doc if tr has been modified by
        // assignIDsForMissing (e.g. to add objectId).
        const currentAttrs = tr.docChanged
          ? (tr.doc.nodeAt(pos)?.attrs ?? nextPara.attrs)
          : nextPara.attrs;
        tr = tr.setNodeMarkup(pos, null, {
          ...currentAttrs,
          dirty: true,
        });
      });
    }

    // Also check paragraphs that existed in prevState but were removed
    // or modified outside the mapped ranges (e.g. the source paragraph
    // in a drag where the deletion maps to a different range than the
    // insertion). Walk prevState.doc's changed ranges and find paragraphs
    // that no longer match.
    for (const range of changedRanges) {
      // Map the range back to prevState coordinates
      const prevFrom = this.mapPosBackward(transactions, Math.max(0, Math.min(range.from, docSize)));
      const prevTo = this.mapPosBackward(transactions, Math.max(0, Math.min(range.to, docSize)));
      if (prevFrom == null || prevTo == null || prevFrom >= prevTo) continue;

      const prevDocSize = prevState.doc.content.size;
      const clampedPrevFrom = Math.max(0, Math.min(prevFrom, prevDocSize));
      const clampedPrevTo = Math.max(0, Math.min(prevTo, prevDocSize));
      if (clampedPrevFrom >= clampedPrevTo) continue;

      prevState.doc.nodesBetween(clampedPrevFrom, clampedPrevTo, (node, pos) => {
        if (node.type !== paraType) return;

        // Map forward to find the corresponding paragraph in nextState
        const nextPos = this.mapPosForward(transactions, pos);
        if (nextPos == null) return; // paragraph was deleted
        if (markedPositions.has(nextPos)) return;

        const nextPara = nextState.doc.nodeAt(nextPos);
        const prevPara = prevState.doc.nodeAt(pos);

        // The forward-mapped position may land on a boundary with no
        // node (e.g. the paragraph was deleted and the position now
        // points at the end of the parent/cell). There is nothing to
        // mark dirty in that case, so skip it instead of letting
        // `setNodeMarkup` throw `RangeError: No node at given position`.
        if (!nextPara) return;

        const didChange = this.didNodeChange(prevPara, nextPara);
        if (!didChange) return;
        if (nextPara?.attrs?.dirty) return;

        markedPositions.add(nextPos);
        tr ??= nextState.tr;
        const currentAttrs = tr.docChanged
          ? (tr.doc.nodeAt(nextPos)?.attrs ?? nextPara.attrs)
          : nextPara.attrs;
        tr = tr.setNodeMarkup(nextPos, null, {
          ...currentAttrs,
          dirty: true,
        });
      });
    }

    return tr;
  }

  /**
   * Maps a position from nextState.doc back to prevState.doc using
   * the transactions' mapping (inverted).
   */
  private mapPosBackward(
    transactions: Transaction[],
    pos: number
  ): number | null {
    let result = pos;
    for (let i = transactions.length - 1; i >= 0; i--) {
      result = transactions[i].mapping.invert().map(result, -1);
    }
    if (result < 0) return null;
    return result;
  }

  /**
   * Maps a position from prevState.doc forward to nextState.doc using
   * the transactions' mapping.
   */
  private mapPosForward(
    transactions: Transaction[],
    pos: number
  ): number | null {
    let result = pos;
    for (const tr of transactions) {
      result = tr.mapping.map(result, 1);
    }
    if (result < 0) return null;
    return result;
  }
}

export function validateAttr(value: unknown): boolean {
  return (
    [null, undefined].includes(value) ||
    ['string', 'number'].includes(typeof value)
  );
}
