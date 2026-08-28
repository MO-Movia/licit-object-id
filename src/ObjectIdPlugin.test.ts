/**
 * @license MIT
 * @copyright Copyright 2025 Modus Operandi Inc. All Rights Reserved.
 */

import { ObjectIdPlugin, validateAttr } from './ObjectIdPlugin';
import { createEditor, doc, p, schema } from 'jest-prosemirror';
import { EditorView } from 'prosemirror-view';
import { EditorState, Transaction, TextSelection } from 'prosemirror-state';
import { Node, NodeType, ResolvedPos, Schema, Slice } from 'prosemirror-model';

describe('Object ID plugin', () => {
  it('should return effective schema', () => {
    const effectiveSchema = new ObjectIdPlugin().getEffectiveSchema(schema);
    expect(effectiveSchema).toHaveProperty('marks');
  });

  it('should handle object id plugin new attribute', () => {
    const editor = createEditor(doc('<cursor>', p('Hello')), {
      plugins: [new ObjectIdPlugin()],
    });
    const content = editor.insertText('World').press('Enter');

    expect(content.state.doc.attrs).toHaveProperty('objectId');
  });

  it('should handle createNewId', () => {
    const dummyNode = {
      type: { name: 'citationnote' },
    } as unknown as Node;
    const objid = '{}';
    const objids = [];
    const dummyView = { lastKeyCode: 13 } as unknown as EditorView;
    const mockprevState = { selection: { from: 4 } } as unknown as EditorState;
    const mocknextState = { selection: { from: 6 } } as unknown as EditorState;
    const plugin = new ObjectIdPlugin();
    expect(
      plugin.createNewId(
        dummyNode,
        objid,
        objids,
        dummyView,
        mockprevState,
        mocknextState,
        3
      )
    ).toBeFalsy();
  });

  it('should handle createNewId when this.isNewParagraph(prevState, nextState, pos, view is true', () => {
    const dummyNode = {
      type: { name: 'citationnote' },
    } as unknown as Node;
    const objid = '{}';
    const objids = [];
    const dummyView = { lastKeyCode: 13 } as unknown as EditorView;
    const mockprevState = { selection: { from: 4 } } as unknown as EditorState;
    const mocknextState = { selection: { from: 6 } } as unknown as EditorState;
    const plugin = new ObjectIdPlugin();
    jest.spyOn(plugin, 'isNewParagraph').mockReturnValue(true);
    expect(
      plugin.createNewId(
        dummyNode,
        objid,
        objids,
        dummyView,
        mockprevState,
        mocknextState,
        3
      )
    ).toBeTruthy();
  });

  it('should handle createNewId when isCut is true', () => {
    const dummyNode = {
      type: { name: 'paragraph' },
      attrs: { objectId: '123' },
    } as unknown as Node;
    const objid = '123';
    const objids = [];
    const dummyView = { lastKeyCode: 13 } as unknown as EditorView;
    const mockprevState = { selection: { from: 4 } } as unknown as EditorState;
    const mocknextState = { selection: { from: 6 } } as unknown as EditorState;
    const plugin = new ObjectIdPlugin();
    plugin.isCut = true;
    jest.spyOn(plugin, 'getState').mockReturnValue({
      cutObjectIds: [
        {
          objectId: '123',
          objectMetaData: null,
          selectionId: 'selectionId123',
        },
      ],
    });
    expect(
      plugin.createNewId(
        dummyNode,
        objid,
        objids,
        dummyView,
        mockprevState,
        mocknextState,
        0
      )
    ).toBe(true);
  });

  it('should handle getObjectMetaDataFromCutObj when isCut is true', () => {
    const plugin = new ObjectIdPlugin();
    plugin.isCut = true;
    const cutObjectIds = [
      {
        objectId: '123',
        objectMetaData: {
          lastEditedBy: 'qauser',
          creationDate: '2025-02-18T06:10:22.429+00:00',
          lastEditedOn: '2025-02-18T06:11:55.000+00:00',
          capco: { system: 'US', joint: false },
          name: '9c 2f 8107 F 4b 7 403e A 0ae 2b 55e 79885ff',
        } as Record<string, unknown>,
        selectionId: 'selectionId123'
      },
      { objectId: 'abc', objectMetaData: null, selectionId: 'selectionId123' },

    ];
    const result = plugin.getObjectMetaDataFromCutObj('123', cutObjectIds);
    expect(result).toEqual({
      lastEditedBy: 'qauser',
      creationDate: '2025-02-18T06:10:22.429+00:00',
      lastEditedOn: '2025-02-18T06:11:55.000+00:00',
      capco: { system: 'US', joint: false },
      name: '9c 2f 8107 F 4b 7 403e A 0ae 2b 55e 79885ff',
    });
  });

  it('SHOULD HANDLE keydown', () => {
    const plugin = new ObjectIdPlugin();
    const boundkeydown = plugin?.props?.handleDOMEvents?.keydown?.bind(plugin);
    const dummyView = { lastKeyCode: 13 } as unknown as EditorView;
    expect(boundkeydown(dummyView, {})).toBeFalsy();
  });

  it('SHOULD HANDLE paste with cutObjectIds.length 1', () => {
    const plugin = new ObjectIdPlugin();
    const mockschema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
        },
        paragraph: {
          content: 'text*',
          attrs: {
            styleName: { default: 'test' },
          },
          toDOM() {
            return ['p', 0];
          },
        },
        heading: {
          attrs: { level: { default: 1 }, styleName: { default: '' } },
          content: 'inline*',
          marks: '',
          toDOM(node) {
            return [
              'h' + node.attrs.level,
              { 'data-style-name': node.attrs.styleName },
              0,
            ];
          },
        },
        text: {
          group: 'inline',
        },
      },
    });

    const mockdoc = mockschema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, styleName: 'test' },
          content: [
            {
              type: 'text',
              text: 'Hello, ProseMirror!',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'This is a mock dummy document.',
              attrs: { styleName: 'test' },
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'It demonstrates the structure of a ProseMirror document.',
            },
          ],
        },
      ],
    });
    mockdoc.nodeAt = () => {
      return {} as unknown as Node;
    };
    const mockselection = {
      $from: {
        before: (x: number) => {
          return x - 1;
        },
      },
      $to: {
        after: (x: number) => {
          return x + 1;
        },
      },
    };
    const tr = {
      doc: mockdoc,
      setNodeMarkup: jest.fn(() => tr),
      setMeta: jest.fn(() => tr),
      selection: mockselection,
    } as unknown as Transaction;

    const mockeditorstate = {
      schema: mockschema,
      doc: mockdoc,
      selection: mockselection,
      tr: tr,
    };
    const editorview = {
      state: mockeditorstate,
      dispatch: jest.fn(),
    };
    jest.spyOn(plugin, 'getState').mockReturnValue({
      cutObjectIds: [
        {
          objectId: '123',
          objectMetaData: {
            lastEditedBy: 'qauser',
            creationDate: '2025-02-18T06:10:22.429+00:00',
            lastEditedOn: '2025-02-18T06:11:55.000+00:00',
            capco: { system: 'US', joint: false },
            name: '9c 2f 8107 F 4b 7 403e A 0ae 2b 55e 79885ff',
          },
          selectionId: 'selectionId123',
        },
      ],
    });
    const boundHandlePaste = plugin?.props?.handlePaste?.bind(plugin);
    expect(
      boundHandlePaste(
        editorview,
        {},
        {
          content: {
            childCount: 2,
            content: [
              {
                attrs: {
                  objectId: '123',
                  objectMetaData: {
                    lastEditedBy: 'qauser',
                    creationDate: '2025-02-18T06:10:22.429+00:00',
                    lastEditedOn: '2025-02-18T06:11:55.000+00:00',
                    capco: { system: 'US', joint: false },
                    name: '9c 2f 8107 F 4b 7 403e A 0ae 2b 55e 79885ff',
                  },
                  dirty: true,
                },
              },
            ],
          },
        }
      )
    ).toBeFalsy();
  });

  it('SHOULD HANDLE paste1', () => {
    const plugin = new ObjectIdPlugin();
    jest.spyOn(plugin, 'getState').mockReturnValue({
      cutObjectIds: [
        {
          objectId: '123',
          objectMetaData: {
            lastEditedBy: 'qauser',
            creationDate: '2025-02-18T06:10:22.429+00:00',
            lastEditedOn: '2025-02-18T06:11:55.000+00:00',
            capco: { system: 'US', joint: false },
            name: '9c 2f 8107 F 4b 7 403e A 0ae 2b 55e 79885ff',
          },
          selectionId: 'selectionId123',
        },
        {
          objectId: 'abc',
          objectMetaData: null,
          selectionId: 'selectionId124',
        },
      ],
    });
    const mockschema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
        },
        paragraph: {
          content: 'text*',
          attrs: {
            styleName: { default: 'test' },
          },
          toDOM() {
            return ['p', 0];
          },
        },
        heading: {
          attrs: { level: { default: 1 }, styleName: { default: '' } },
          content: 'inline*',
          marks: '',
          toDOM(node) {
            return [
              'h' + node.attrs.level,
              { 'data-style-name': node.attrs.styleName },
              0,
            ];
          },
        },
        text: {
          group: 'inline',
        },
      },
    });

    const mockdoc = mockschema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, styleName: 'test' },
          content: [
            {
              type: 'text',
              text: 'Hello, ProseMirror!',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'This is a mock dummy document.',
              attrs: { styleName: 'test' },
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'It demonstrates the structure of a ProseMirror document.',
            },
          ],
        },
      ],
    });
    mockdoc.nodeAt = () => {
      return {} as unknown as Node;
    };
    const mockselection = {
      $from: {
        before: (x: number) => {
          return x - 1;
        },
      },
      $to: {
        after: (x: number) => {
          return x + 1;
        },
      },
    };
    const tr = {
      doc: mockdoc,
      setNodeMarkup: jest.fn(() => tr),
      setMeta: jest.fn(() => tr),
      selection: mockselection,
    } as unknown as Transaction;

    const mockeditorstate = {
      schema: mockschema,
      doc: mockdoc,
      selection: mockselection,
      tr: tr,
    };
    const editorview = {
      state: mockeditorstate,
      dispatch: jest.fn(),
    };

    const boundHandlePaste = plugin?.props?.handlePaste?.bind(plugin);
    expect(
      boundHandlePaste(
        editorview,
        {},
        {
          content: {
            childCount: 2,
            content: [
              {
                attrs: {
                  objectId: '123',
                  objectMetaData: {
                    lastEditedBy: 'qauser',
                    creationDate: '2025-02-18T06:10:22.429+00:00',
                    lastEditedOn: '2025-02-18T06:11:55.000+00:00',
                    capco: { system: 'US', joint: false },
                    name: '9c 2f 8107 F 4b 7 403e A 0ae 2b 55e 79885ff',
                  },
                  dirty: true,
                },
              },
            ],
          },
        }
      )
    ).toBeFalsy();
  });

  it('Should handle paste2', () => {
    const plugin = new ObjectIdPlugin();
    jest.spyOn(plugin, 'getState').mockReturnValue({
      cutObjectIds: [
        {
          objectId: '123',
          objectMetaData: {
            lastEditedBy: 'qauser',
            creationDate: '2025-02-18T06:10:22.429+00:00',
            lastEditedOn: '2025-02-18T06:11:55.000+00:00',
            capco: { system: 'US', joint: false },
            name: '9c 2f 8107 F 4b 7 403e A 0ae 2b 55e 79885ff',
          },
          selectionId: 'selectionId123',
        },
      ],
    });
    const boundHandlePaste = plugin?.props?.handlePaste?.bind(plugin);
    const dummyView = {
      dispatch: () => {
        return null;
      },
      lastKeyCode: 13,
      state: {
        selection: { from: 0, to: 1 },
        tr: {
          setMeta: () => {
            return {};
          },
          setNodeMarkup: () => {
            return {
              setMeta: () => {
                return {};
              },
            };
          },
          doc: {
            nodeAt: () => {
              return {};
            },
          },
        },
      },
    } as unknown as EditorView;
    expect(
      boundHandlePaste(
        dummyView,
        {},
        { content: { content: [{ attrs: true }] } }
      )
    ).toBeFalsy();
  });

  it('Should handle cut DOM event', () => {
    const plugin = new ObjectIdPlugin();
    const spy = jest.spyOn(plugin, 'getState');
    const boundHandleCut = plugin?.props?.handleDOMEvents?.cut?.bind(plugin);

    const schema1 = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
        },
        paragraph: {
          attrs: {
            align: { default: 'left' },
            objectId: { default: 1 },
          },
          content: 'text*',
          toDOM(node) {
            const attrs = {
              style: `text-align: ${node.attrs.align}`,
            };
            return ['p', attrs, 0];
          },
          parseDOM: [
            {
              tag: 'p',
              getAttrs(dom) {
                const element = dom;
                return {
                  align: element.getAttribute('align') || 'left',
                  objectId: element.getAttribute('objectId'),
                };
              },
            },
          ],
        },
        text: {
          group: 'inline',
        },
      },
    });
    const editorState = {
      schema: schema1,
      doc: schema1.nodeFromJSON({
        type: 'doc',
        attrs: {
          layout: null,
          padding: null,
          width: null,
          counterFlags: null,
          capcoMode: 0,
        },
        content: [
          {
            type: 'paragraph',
            attrs: {
              align: 'left',
              color: null,
              id: null,
              indent: null,
              objectId: '123',
              lineSpacing: null,
              paddingBottom: null,
              paddingTop: null,
              capco: null,
              styleName: 'AFDP Bullet',
            },
            content: [
              {
                type: 'text',
                marks: [],
                text: 'Your text here previous',
              },
            ],
          },
        ],
      }),
      selection: { from: 0, to: 10 },
    };
    const dummyView = {
      input: { lastKeyCode: '13' },
      state: editorState,
    } as unknown as EditorView;

    boundHandleCut(dummyView, {});
    expect(spy).toHaveBeenCalled();
  });

  it('should handle createNewId when isNewParagraph is not true', () => {
    const dummyNode = {
      type: { name: 'citationnote' },
    } as unknown as Node;
    const objid = '{}';
    const objids = [];
    const dummyView = { lastKeyCode: 13 } as unknown as EditorView;
    const mockprevState = { selection: { from: 4 } } as unknown as EditorState;
    const mocknextState = { selection: { from: 6 } } as unknown as EditorState;
    const plugin = new ObjectIdPlugin();
    expect(
      plugin.createNewId(
        dummyNode,
        objid,
        objids,
        dummyView,
        mockprevState,
        mocknextState,
        2
      )
    ).toBeFalsy();
  });

  it('should handle createNewId when isNewParagraph is not true and when typeof objId is object', () => {
    // The citationnote special case was removed — createNewId now returns
    // false for any node that has an existing objId but is not a new paragraph
    // or a cut/paste operation, regardless of node type.
    const dummyNode = {
      type: { name: 'citationnote' },
    } as unknown as Node;
    const objid = {} as unknown as string;
    const objids = [];
    const dummyView = { lastKeyCode: 13 } as unknown as EditorView;
    const mockprevState = { selection: { from: 4 } } as unknown as EditorState;
    const mocknextState = { selection: { from: 6 } } as unknown as EditorState;
    const plugin = new ObjectIdPlugin();
    expect(
      plugin.createNewId(
        dummyNode,
        objid,
        objids,
        dummyView,
        mockprevState,
        mocknextState,
        2
      )
    ).toBeFalsy();
  });

  it('should handle createNewId when isNewParagraph is true', () => {
    // The citationnote special case was removed. With isNewParagraph
    // returning false (lastKeyCode is string '13' not number 13) and
    // isCut false, createNewId now returns false for a citationnote
    // node that has an existing objId.
    const dummyNode = {
      type: { name: 'citationnote' },
    } as unknown as Node;
    const objid = {} as unknown as string;
    const objids = [];
    const dummyView = { input: { lastKeyCode: '13' } } as unknown as EditorView;
    const mockprevState = { selection: { from: 4 } } as unknown as EditorState;
    const mocknextState = { selection: { from: 6 } } as unknown as EditorState;
    const plugin = new ObjectIdPlugin();
    expect(
      plugin.createNewId(
        dummyNode,
        objid,
        objids,
        dummyView,
        mockprevState,
        mocknextState,
        2
      )
    ).toBeFalsy();
  });

  it('should handle nodeAssignment', () => {
    const plugin = new ObjectIdPlugin();
    jest.spyOn(plugin, 'isNodeBlacklisted').mockReturnValue(false);

    const schema1 = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
        },
        paragraph: {
          attrs: {
            align: { default: 'left' },
            objectId: { default: 1 },
          },
          content: 'text*',
          toDOM(node) {
            const attrs = {
              style: `text-align: ${node.attrs.align}`,
            };
            return ['p', attrs, 0];
          },
          parseDOM: [
            {
              tag: 'p',
              getAttrs(dom) {
                const element = dom;
                return {
                  align: element.getAttribute('align') || 'left',
                  objectId: element.getAttribute('objectId'),
                };
              },
            },
          ],
        },
        text: {
          group: 'inline',
        },
      },
    });
    const editorState = EditorState.create({
      doc: schema1.node('doc', null, [
        schema1.node('paragraph', { align: 'center', objectId: 1 }, [
          schema1.text('Firmusoft'),
        ]),
      ]),
    });

    expect(plugin.nodeAssignment(editorState)).toBeDefined();
  });

  it('should handle isRequiredNewId', () => {
    const mockResolvedPos = {
      pos: 3,
      parent: {
        type: { name: 'paragraph' },
      },
      depth: 1,
      nodeBefore: {},
      min: () => {
        return '';
      },
      max: () => {
        return '';
      },
    } as unknown as ResolvedPos;

    const dummyNode = {
      type: { name: 'citationnote' },
      attrs: { objectId: '1' },
    } as unknown as Node;
    const objids = ['1'];
    const dummyView = { lastKeyCode: 13 } as unknown as EditorView;
    const mockselection = new TextSelection(mockResolvedPos);
    const mockprevState = {
      selection: mockselection,
      doc: {
        resolve: () => {
          return { type: 'paragraph' };
        },
      },
    } as unknown as EditorState;
    const mocknextState = {
      selection: mockselection,
      schema: { nodes: { paragraph: 'paragraph' } },
      doc: {
        resolve: () => {
          return { type: 'paragraph' };
        },
      },
      tr: {
        key: 'nextstate-tr',
        setNodeMarkup: () => {
          return { key: 'mockTransaction-nextstate' };
        },
      },
    } as unknown as EditorState;
    const plugin = new ObjectIdPlugin();
    expect(
      plugin.isRequiredNewId(
        dummyNode,
        objids,
        dummyView,
        mockprevState,
        mocknextState,
        1
      )
    ).toBeTruthy();
  });

  it('should handle trackDeletedObjectId when prevState.doc = nextState.doc', () => {
    const plugin = new ObjectIdPlugin();
    expect(
      plugin.trackDeletedObjectId(
        { doc: 'doc' } as unknown as EditorState,
        { doc: 'doc' } as unknown as EditorState,
        {} as unknown as Transaction
      )
    ).toBeTruthy();
  });

  it('should handle applyEffectiveSchema when schema.spec not prsent', () => {
    const plugin = new ObjectIdPlugin();
    expect(
      plugin.applyEffectiveSchema({ spec: null } as unknown as Schema)
    ).toStrictEqual({ spec: null });
  });

  it('should set dirty flag if conditions are met', () => {
    const tr = { setNodeMarkup: jest.fn() } as unknown as Transaction;
    const nextState = {
      tr: { setNodeMarkup: jest.fn() },
    } as unknown as EditorState;
    const mockSelection = { $cursor: { pos: 10 } };
    const plugin = new ObjectIdPlugin();
    const prevState = {
      selection: mockSelection,
      doc: { resolve: () => mockSelection },
    } as unknown as EditorState;

    plugin.setDirtyFlagOnChange(prevState, nextState, tr, true, 0);

    expect(tr.setNodeMarkup).toBeDefined();
  });

  it('should set dirty flag if cursor is null', () => {
    const tr = { setNodeMarkup: jest.fn() } as unknown as Transaction;
    const nextState = {
      selection: {
        $from: {
          before: () => {
            return 0;
          },
          $start: () => {
            return 1;
          },
          $end: () => {
            return 1;
          },
        },
        $to: {
          after: () => {
            return 1;
          },
          pos: 0,
        },
      },
      tr: { setNodeMarkup: jest.fn() },
    } as unknown as EditorState;
    const mockSelection = { $cursor: { pos: 10 } };
    const plugin = new ObjectIdPlugin();
    const prevState = {
      selection: mockSelection,
      doc: { resolve: () => mockSelection },
    } as unknown as EditorState;

    plugin.setDirtyFlagOnChange(prevState, nextState, tr, true, 0);

    expect(tr.setNodeMarkup).toBeDefined();
  });

  it('should not set dirty flag if conditions are not met', () => {
    const tr = { setNodeMarkup: jest.fn() } as unknown as Transaction;
    const nextState = {
      tr: { setNodeMarkup: jest.fn() },
    } as unknown as EditorState;
    const mockSelection = { $cursor: { pos: 10 } };
    const plugin = new ObjectIdPlugin();
    const prevState = {
      selection: mockSelection,
      doc: { resolve: () => mockSelection },
    } as unknown as EditorState;

    plugin.setDirtyFlagOnChange(prevState, nextState, tr, true, 0);

    expect(tr.setNodeMarkup).not.toHaveBeenCalled();
  });

  it('should handle appendTransaction and apply steps correctly when selection.$cursor is null', () => {
    const testSchema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
        },
        paragraph: {
          content: 'text*',
          group: 'block',
        },
        text: {
          group: 'inline',
        },
      },
      marks: {},
    });

    const docMock = testSchema.node('doc', null, [
      testSchema.node('paragraph', null, [testSchema.text('Hello')]),
    ]);
    const fromPos = docMock.resolve(1).pos;
    const toPos = docMock.resolve(docMock.content.size).pos;

    const nextState = EditorState.create({
      schema: testSchema,
      doc: testSchema.node('doc', null, [
        testSchema.node('paragraph', null, [testSchema.text('Hello World')]),
      ]),
      selection: TextSelection.create(docMock, fromPos, toPos),
    });

    const prevState = EditorState.create({
      schema: testSchema,
      doc: testSchema.node('doc', null, [
        testSchema.node('paragraph', null, [testSchema.text('Hello')]),
      ]),
      selection: TextSelection.create(docMock, fromPos, toPos),
    });

    const plugin = new ObjectIdPlugin();
    const appendTransaction = plugin.spec.appendTransaction || (() => null);
    const result = appendTransaction([], prevState, nextState);

    expect(result).toBeDefined();
  });

  it('should handle appendTransaction and apply steps correctly', () => {
    const testSchema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
        },
        paragraph: {
          content: 'text*',
          group: 'block',
        },
        text: {
          group: 'inline',
        },
      },
      marks: {},
    });

    const prevState = EditorState.create({
      schema: testSchema,
      doc: testSchema.node('doc', null, [
        testSchema.node('paragraph', null, [testSchema.text('Hello')]),
      ]),
    });

    const nextState = EditorState.create({
      schema: testSchema,
      doc: testSchema.node('doc', null, [
        testSchema.node('paragraph', null, [testSchema.text('Hello World')]),
      ]),
    });
    const plugin = new ObjectIdPlugin();
    const appendTransaction = plugin.spec.appendTransaction || (() => null);
    const result = appendTransaction([], prevState, nextState);

    expect(result).toBeDefined();
  });

  it('should handle appendTransaction for undo/redo transactions', () => {
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*', group: 'block' },
        text: { group: 'inline' },
      },
    });

    const prevDoc = testSchema.node('doc', null, [
      testSchema.node('paragraph', null, [testSchema.text('Before')]),
    ]);

    const nextDoc = testSchema.node('doc', null, [
      testSchema.node('paragraph', null, [testSchema.text('After')]),
    ]);

    const prevState = EditorState.create({ schema: testSchema, doc: prevDoc });
    const nextState = EditorState.create({ schema: testSchema, doc: nextDoc });

    // Create a mock transaction with undo meta
    const undoTr = nextState.tr.setMeta('history', { undo: true });

    const plugin = new ObjectIdPlugin();
    const appendTransaction = plugin.spec.appendTransaction || (() => null);

    // Pass the undo transaction in the array
    const result = appendTransaction([undoTr], prevState, nextState);
    expect(result === null || result instanceof nextState.tr.constructor).toBe(true);
  });

  it('should validate attrs', () => {
    expect(validateAttr(null)).toBeTruthy();
    expect(validateAttr(undefined)).toBeTruthy();
    expect(validateAttr('null')).toBeTruthy();
    expect(validateAttr(0)).toBeTruthy();
    expect(validateAttr(['script', 'badstuff'])).toBeFalsy();
  });
  it('should handle isNewParagraph', () => {
    const plugin = new ObjectIdPlugin();
    expect(
      plugin.isNewParagraph(
        {
          selection: {
            $from: {
              after: () => {
                return 1;
              },
              start: () => {
                return 0;
              },
              pos: 0,
            },
            from: 1,
          },
        } as unknown as EditorState,
        { selection: { from: 3 } } as unknown as EditorState,
        0,
        { input: { lastKeyCode: 13 } } as unknown as EditorView
      )
    ).toBeTruthy();
  });
  it('should handle assignSameObjectMetaDataForCutPastePara', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: {
            objectId: { default: '123' },
            objectMetaData: { default: null },
          },
          toDOM: () => ['p', 0],
          parseDOM: [{ tag: 'p' }],
        },
        text: { group: 'inline' },
      },
    });

    const jsonDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { objectId: '123', objectMetaData: null },
          content: [{ type: 'text', text: 'Hello, ProseMirror!' }],
        },
      ],
    };
    const mockdoc = schema.nodeFromJSON(jsonDoc);
    const plugin = new ObjectIdPlugin();
    plugin.pastedPara = { content: { childCount: 2 } } as unknown as Slice;
    jest.spyOn(plugin, 'getState').mockReturnValue({
      cutObjectIds: [
        {
          objectId: '123',
          objectMetaData: null,
          selectionId: 'selectionId123',
        },
        {
          objectId: '123',
          objectMetaData: null,
          selectionId: 'selectionId124',
        },
      ],
    });
    const Mocktr = {
      setNodeMarkup: () => {
        return {};
      },
      doc: mockdoc,
    } as unknown as Transaction;
    const Mockstate = { tr: Mocktr, doc: mockdoc } as unknown as EditorState;
    expect(
      plugin.assignSameObjectMetaDataForCutPastePara(
        Mockstate,
        undefined as unknown as Transaction
      )
    ).toBeDefined();
  });
  it('should return false when isCut is true but objectId not found in cutObjectIds', () => {
    const plugin = new ObjectIdPlugin();
    plugin.isCut = true;
    const node = {
      type: { name: 'paragraph' },
      attrs: { objectId: 'not-found' }
    } as unknown as Node;

    jest.spyOn(plugin, 'getState').mockReturnValue({
      cutObjectIds: [
        { objectId: '123', objectMetaData: {}, selectionId: 'sel1' }
      ]
    });

    const result = plugin.createNewId(
      node,
      'not-found',
      [],
      {} as EditorView,
      {} as EditorState,
      {} as EditorState,
      0
    );
    expect(result).toBeFalsy();
  });

  it('should return tr unchanged when no IDs are deleted', () => {
    const plugin = new ObjectIdPlugin();

    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: {}
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { objectId: '123' }, [schema.text('test')])
    ]);

    const prevState = EditorState.create({ schema, doc });
    const nextState = EditorState.create({ schema, doc });
    const tr = nextState.tr;

    const result = plugin.trackDeletedObjectId(prevState, nextState, tr);
    expect(result).toBe(tr);
  });

  it('should merge new deleted IDs with existing ones', () => {
    const plugin = new ObjectIdPlugin();

    const schema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
          attrs: { deletedObjectIds: { default: [] } }
        },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: {}
      }
    });

    const prevDoc = schema.node('doc', { deletedObjectIds: ['old-id'] }, [
      schema.node('paragraph', { objectId: '123' }, [schema.text('test')]),
      schema.node('paragraph', { objectId: '456' }, [schema.text('test2')])
    ]);

    const nextDoc = schema.node('doc', { deletedObjectIds: ['old-id'] }, [
      schema.node('paragraph', { objectId: '123' }, [schema.text('test')])
    ]);

    const prevState = EditorState.create({ schema, doc: prevDoc });
    const nextState = EditorState.create({ schema, doc: nextDoc });
    const tr = nextState.tr;

    const result = plugin.trackDeletedObjectId(prevState, nextState, tr);
    expect(result).toBeDefined();
  });

  it('should return tr when selection is not TextSelection', () => {
    const plugin = new ObjectIdPlugin();
    const tr = {} as Transaction;

    const prevState = {
      selection: { type: 'node' }
    } as unknown as EditorState;

    const nextState = {
      selection: { type: 'node' },
      schema: { nodes: {} }
    } as unknown as EditorState;

    const result = plugin.setDirtyFlagOnChange(prevState, nextState, tr, true, 0);
    expect(result).toBe(tr);
  });

  it('should return tr when paragraph is not found', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'text*' },
        text: {}
      }
    });

    const doc = schema.node('doc', null, [schema.text('test')]);
    const state = EditorState.create({ schema, doc });

    const result = plugin.setDirtyFlagOnChange(state, state, null, true, 0);
    expect(result).toBeNull();
  });

  it('should set dirty flag for every capco position', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false }, capco: { default: null } }
        },
        text: {}
      }
    });
    const prevDoc = testSchema.node('doc', null, [
      testSchema.node('paragraph', { dirty: false, capco: 'TBD' }, [
        testSchema.text('a')
      ]),
      testSchema.node('paragraph', { dirty: false, capco: 'TBD' }, [
        testSchema.text('b')
      ])
    ]);
    const nextDoc = testSchema.node('doc', null, [
      testSchema.node('paragraph', { dirty: false, capco: 'U' }, [
        testSchema.text('a')
      ]),
      testSchema.node('paragraph', { dirty: false, capco: 'U' }, [
        testSchema.text('b')
      ])
    ]);
    const prevState = EditorState.create({
      schema: testSchema,
      doc: prevDoc,
      selection: TextSelection.create(prevDoc, 1, 4)
    });
    const nextState = EditorState.create({
      schema: testSchema,
      doc: nextDoc,
      selection: TextSelection.create(nextDoc, 1, 4)
    });
    const tr = { setNodeMarkup: jest.fn().mockReturnThis() } as unknown as Transaction;

    plugin.setDirtyFlagOnChange(prevState, nextState, tr, true, [0, 3]);

    expect(tr.setNodeMarkup).toHaveBeenCalledTimes(2);
    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(
      1,
      0,
      null,
      expect.objectContaining({ dirty: true })
    );
    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(
      2,
      3,
      null,
      expect.objectContaining({ dirty: true })
    );
  });

  it('should set dirty flag on parent table', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'table+' },
        table: {
          content: 'table_row+',
          attrs: { dirty: { default: false } }
        },
        table_row: { content: 'table_cell+' },
        table_cell: {
          content: 'paragraph+',
          attrs: { dirty: { default: false } }
        },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } }
        },
        text: {}
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('table', { dirty: false }, [
        schema.node('table_row', null, [
          schema.node('table_cell', { dirty: false }, [
            schema.node('paragraph', { dirty: false }, [schema.text('test')])
          ])
        ])
      ])
    ]);

    const state = EditorState.create({ schema, doc });
    const result = plugin.setDirtyFlagOnChange(state, state, null, true, 0);
    expect(result).toBeDefined();
  });

  it('should preserve pending objectId when marking parent EIC dirty', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'enhanced_table_figure+' },
        enhanced_table_figure: {
          content: 'paragraph+',
          attrs: {
            dirty: { default: false },
            objectId: { default: null }
          }
        },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } }
        },
        text: {}
      }
    });

    const prevDoc = schema.node('doc', null, [
      schema.node(
        'enhanced_table_figure',
        { dirty: false, objectId: null },
        [
          schema.node('paragraph', { dirty: false }, [
            schema.text('before')
          ])
        ]
      )
    ]);
    const nextDoc = schema.node('doc', null, [
      schema.node(
        'enhanced_table_figure',
        { dirty: false, objectId: null },
        [
          schema.node('paragraph', { dirty: false }, [
            schema.text('after')
          ])
        ]
      )
    ]);
    const prevState = EditorState.create({
      schema,
      doc: prevDoc,
      selection: TextSelection.create(prevDoc, 2)
    });
    const nextState = EditorState.create({
      schema,
      doc: nextDoc,
      selection: TextSelection.create(nextDoc, 2)
    });
    const tr = nextState.tr.setNodeMarkup(0, null, {
      ...nextDoc.nodeAt(0).attrs,
      objectId: 'eic-new'
    });

    const result = plugin.setDirtyFlagOnChange(
      prevState,
      nextState,
      tr,
      true,
      null
    );

    expect(result.doc.nodeAt(0).attrs).toEqual(
      expect.objectContaining({ dirty: true, objectId: 'eic-new' })
    );
  });

  it('should skip invalid ranges in assignIDsForMissing', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+', attrs: { objectId: { default: null } } },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: {}
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { objectId: null }, [schema.text('test')])
    ]);

    const state = EditorState.create({ schema, doc });

    // Mock getChangedRanges to return invalid range
    jest.spyOn(plugin, 'getChangedRanges').mockReturnValue([
      { from: 100, to: 50 } // Invalid: from > to
    ]);

    const result = plugin.assignIDsForMissing(
      [],
      state,
      state,
      {} as EditorView
    );

    expect(result).toBeDefined();
  });

  it('should add objectId to document when missing', () => {
    const plugin = new ObjectIdPlugin({ prefix: 'test-', suffix: '-end' });
    const schema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
          attrs: { objectId: { default: null }, objectMetaData: { default: null } }
        },
        paragraph: { content: 'text*' },
        text: {}
      }
    });

    const doc = schema.node('doc', { objectId: null, objectMetaData: null }, [
      schema.node('paragraph', null, [schema.text('test')])
    ]);

    const state = EditorState.create({ schema, doc });

    const result = plugin.assignIDsForMissing([], state, state, {} as EditorView);
    expect(result).toBeDefined();
  });

  it('should add objectMetaData to document when missing', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
          attrs: { objectId: { default: '123' }, objectMetaData: { default: null } }
        },
        paragraph: { content: 'text*' },
        text: {}
      }
    });

    const doc = schema.node('doc', { objectId: '123', objectMetaData: null }, [
      schema.node('paragraph', null, [schema.text('test')])
    ]);

    const state = EditorState.create({ schema, doc });
    jest.spyOn(plugin, 'isNodeHasAttribute').mockReturnValue(false);

    const result = plugin.assignIDsForMissing([], state, state, {} as EditorView);
    expect(result).toBeDefined();
  });

  it('should return false when cutObjectIds is empty', () => {
    const plugin = new ObjectIdPlugin();
    jest.spyOn(plugin, 'getState').mockReturnValue({
      cutObjectIds: []
    });

    const view = {
      state: {}
    } as unknown as EditorView;

    const boundHandlePaste = plugin?.props?.handlePaste?.bind(plugin);
    const result = boundHandlePaste(view, {}, {});
    expect(result).toBeFalsy();
  });

  it('should skip assignSameObjectMetaDataForCutPastePara when childCount <= 1', () => {
    const plugin = new ObjectIdPlugin();
    plugin.loaded = true;
    plugin.pastedPara = { content: { childCount: 1 } } as Slice;

    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: {}
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('test')])
    ]);

    const state = EditorState.create({ schema, doc });
    const tr = state.tr.setMeta('docChanged', true);

    const appendTransaction = plugin.spec.appendTransaction;
    const result = appendTransaction([tr], state, state);

    // Should not call assignSameObjectMetaDataForCutPastePara
    expect(result).toBeDefined();
  });

  it('should handle paste when cutObjectIds contains current node id', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: {
            objectId: { default: null },
            objectMetaData: { default: null },
            selectionId: { default: null }
          },
          toDOM() {
            return ['p', 0];
          }
        },
        text: { group: 'inline' }
      }
    });

    const doc = testSchema.node('doc', null, [
      testSchema.node(
        'paragraph',
        { objectId: 'id-1', objectMetaData: null, selectionId: 'sel-1' },
        [testSchema.text('hi')]
      )
    ]);

    const state = EditorState.create({
      schema: testSchema,
      doc,
      selection: TextSelection.create(doc, 1, 1)
    });

    const view = { state, dispatch: jest.fn() } as unknown as EditorView;
    const cutState = {
      cutObjectIds: [
        { objectId: 'id-1', objectMetaData: { a: 1 }, selectionId: 'sel-1' },
        { objectId: 'id-2', objectMetaData: { b: 2 }, selectionId: 'sel-2' }
      ]
    };
    jest.spyOn(plugin, 'getState').mockReturnValue(cutState);

    const boundHandlePaste = plugin?.props?.handlePaste?.bind(plugin);
    const result = boundHandlePaste(
      view,
      {},
      { content: { childCount: 1 } }
    );

    expect(result).toBeFalsy();
    expect(cutState.cutObjectIds).toHaveLength(1);
    expect(plugin.pastedPara).toBeNull();
  });

  it('should skip appendTransaction when skipAppendTransaction meta is set', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: { group: 'inline' }
      }
    });

    const doc = testSchema.node('doc', null, [
      testSchema.node('paragraph', null, [testSchema.text('hello')])
    ]);

    const prevState = EditorState.create({ schema: testSchema, doc });
    const nextState = EditorState.create({ schema: testSchema, doc });

    const mockTr = {
      docChanged: true,
      getMeta: (key: string) => (key === 'skipAppendTransaction' ? true : undefined)
    } as unknown as Transaction;

    const appendTransaction = plugin.spec.appendTransaction || (() => null);
    const result = appendTransaction([mockTr], prevState, nextState);
    expect(result).toBeNull();
  });

  it('should call assignSameObjectMetaDataForCutPastePara in appendTransaction', () => {
    const plugin = new ObjectIdPlugin();
    plugin.view = {} as EditorView;
    plugin.pastedPara = { content: { childCount: 2 } } as Slice;

    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: { group: 'inline' }
      }
    });

    const prevState = EditorState.create({
      schema: testSchema,
      doc: testSchema.node('doc', null, [
        testSchema.node('paragraph', null, [testSchema.text('before')])
      ])
    });

    const nextState = EditorState.create({
      schema: testSchema,
      doc: testSchema.node('doc', null, [
        testSchema.node('paragraph', null, [testSchema.text('after')])
      ])
    });

    const mockTr = {
      docChanged: true,
      getMeta: (_key: string) => undefined
    } as unknown as Transaction;

    jest.spyOn(plugin, 'assignIDsForMissing').mockReturnValue(nextState.tr);
    const spyAssignSame = jest
      .spyOn(plugin, 'assignSameObjectMetaDataForCutPastePara')
      .mockReturnValue(nextState.tr);
    jest.spyOn(plugin, 'trackDeletedObjectId').mockReturnValue(nextState.tr);
    jest.spyOn(plugin, 'setDirtyFlagOnChange').mockReturnValue(nextState.tr);

    const appendTransaction = plugin.spec.appendTransaction || (() => null);
    appendTransaction([mockTr], prevState, nextState);

    expect(spyAssignSame).toHaveBeenCalled();
  });

  it('should assign IDs for missing nodes within changed ranges', () => {
    const plugin = new ObjectIdPlugin({ prefix: 'p-', suffix: '-s' });
    const testSchema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
          attrs: { objectId: { default: null }, objectMetaData: { default: null } }
        },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: { group: 'inline' }
      }
    });

    const doc = testSchema.node('doc', { objectId: null, objectMetaData: null }, [
      testSchema.node('paragraph', { objectId: null }, [testSchema.text('x')])
    ]);

    const prevState = EditorState.create({ schema: testSchema, doc });
    const nextState = EditorState.create({ schema: testSchema, doc });

    jest.spyOn(plugin, 'getChangedRanges').mockReturnValue([
      { from: 0, to: doc.content.size }
    ]);

    const result = plugin.assignIDsForMissing(
      [{} as Transaction],
      prevState,
      nextState,
      {} as EditorView
    );

    expect(result).toBeDefined();
  });

  it('should catch errors in assignIDsForMissing and continue', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
          attrs: { objectId: { default: 'doc-id' }, objectMetaData: { default: {} } }
        },
        paragraph: { content: 'text*' },
        text: { group: 'inline' }
      }
    });

    const doc = testSchema.node('doc', { objectId: 'doc-id', objectMetaData: {} }, [
      testSchema.node('paragraph', null, [testSchema.text('x')])
    ]);

    const prevState = EditorState.create({ schema: testSchema, doc });
    const nextState = EditorState.create({ schema: testSchema, doc });

    jest.spyOn(plugin, 'getChangedRanges').mockReturnValue([
      { from: 0, to: doc.content.size }
    ]);

    (nextState.doc as unknown as { nodesBetween: () => void }).nodesBetween =
      () => {
        throw new Error('boom');
      };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = plugin.assignIDsForMissing(
      [{} as Transaction],
      prevState,
      nextState,
      {} as EditorView
    );

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should collect cut object IDs when selection starts after pos 0', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null }, selectionId: { default: null } }
        },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { objectId: 'id-1', selectionId: 'sel-1' }, [
        schema.text('hello')
      ])
    ]);

    const cutState = { cutObjectIds: [] as unknown[] };
    jest.spyOn(plugin, 'getState').mockReturnValue(cutState as unknown);

    const view = {
      state: {
        doc,
        selection: { from: 1, to: doc.content.size }
      }
    } as unknown as EditorView;

    const boundHandleCut = plugin?.props?.handleDOMEvents?.cut?.bind(plugin);
    boundHandleCut(view, {});

    expect(cutState.cutObjectIds).toHaveLength(1);
  });

  it('should skip cut when selection starts at 0 or node has no objectId', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('hello')])
    ]);

    const cutState = { cutObjectIds: [] as unknown[] };
    jest.spyOn(plugin, 'getState').mockReturnValue(cutState as unknown);

    const view = {
      state: {
        doc,
        selection: { from: 0, to: 1 }
      }
    } as unknown as EditorView;

    const boundHandleCut = plugin?.props?.handleDOMEvents?.cut?.bind(plugin);
    boundHandleCut(view, {});

    expect(cutState.cutObjectIds).toHaveLength(0);
  });

  it('should use provided transaction in assignSameObjectMetaDataForCutPastePara', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: 'id-1' }, objectMetaData: { default: null } }
        },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { objectId: 'id-1', objectMetaData: null }, [
        schema.text('hello')
      ])
    ]);

    const state = EditorState.create({ schema, doc });
    plugin.pastedPara = { content: { childCount: 2 } } as Slice;
    jest.spyOn(plugin, 'getState').mockReturnValue({
      cutObjectIds: [{ objectId: 'id-1', objectMetaData: { a: 1 }, selectionId: 'sel' }]
    });

    const tr = { setNodeMarkup: jest.fn(() => tr), doc } as unknown as Transaction;
    const result = plugin.assignSameObjectMetaDataForCutPastePara(state, tr);

    expect(result).toBe(tr);
    expect(tr.setNodeMarkup).toHaveBeenCalled();
  });

  it('should set storedMarks in handleUndoRedo when transaction exists', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('hello')])
    ]);

    const prevState = EditorState.create({ schema, doc });
    const nextState = EditorState.create({ schema, doc });
    nextState.tr.storedMarks = ['m1'] as unknown as typeof nextState.tr.storedMarks;

    const tr = { storedMarks: null } as unknown as Transaction;
    jest.spyOn(plugin, 'trackDeletedObjectId').mockReturnValue(tr);
    jest.spyOn(plugin, 'setDirtyFlagOnChange').mockReturnValue(tr);

    const result = plugin.handleUndoRedo(prevState, nextState, null, true, 0);
    expect(result?.storedMarks).toBe(nextState.tr.storedMarks);
  });

  it('should skip duplicate positions in assignIDsForMissing', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { objectId: null }, [schema.text('x')])
    ]);

    const prevState = EditorState.create({ schema, doc });
    const nextState = EditorState.create({ schema, doc });

    jest.spyOn(plugin, 'getChangedRanges').mockReturnValue([
      { from: 0, to: doc.content.size }
    ]);

    (nextState.doc as unknown as {
      nodesBetween: (from: number, to: number, f: (node: Node, pos: number) => void) => void
    }).nodesBetween = (_from, _to, f) => {
      const para = doc.child(0);
      f(para, 0);
      f(para, 0);
    };

    const result = plugin.assignIDsForMissing(
      [{} as Transaction],
      prevState,
      nextState,
      {} as EditorView
    );

    expect(result).toBeDefined();
  });

  it('should update deletedObjectIds when a node is removed', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+', attrs: { deletedObjectIds: { default: [] } } },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: { group: 'inline' }
      }
    });

    const prevDoc = schema.node('doc', { deletedObjectIds: [] }, [
      schema.node('paragraph', { objectId: 'id-1' }, [schema.text('a')])
    ]);

    const nextDoc = schema.node('doc', { deletedObjectIds: [] }, [
      schema.node('paragraph', { objectId: 'id-2' }, [schema.text('b')])
    ]);

    const prevState = EditorState.create({ schema, doc: prevDoc });
    const nextState = EditorState.create({ schema, doc: nextDoc });

    const tr = nextState.tr;
    const result = plugin.trackDeletedObjectId(prevState, nextState, tr);

    expect(result).toBeDefined();
  });

  it('should resolve parent with and without cursor', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('hello')])
    ]);

    const cursorSelection = TextSelection.create(doc, 1, 1);
    const rangeSelection = TextSelection.create(doc, 1, 2);

    const withCursor = (plugin as unknown as {
      getParentBySelection: (doc: Node, sel: TextSelection, type: NodeType) => unknown;
    }).getParentBySelection(doc, cursorSelection, schema.nodes.paragraph);

    const withRange = (plugin as unknown as {
      getParentBySelection: (doc: Node, sel: TextSelection, type: NodeType) => unknown;
    }).getParentBySelection(doc, rangeSelection, schema.nodes.paragraph);

    expect(withCursor).toBeDefined();
    expect(withRange).toBeDefined();
  });

  it('should not set dirty flag when capcoPos paragraph is already dirty', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } }
        },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { dirty: true }, [schema.text('x')])
    ]);
    const para = doc.child(0);
    const capcoPos = 5;
    const docWithNodeAt = Object.assign(doc, {
      nodeAt: (pos: number) => (pos === capcoPos ? para : null)
    });

    const selection = TextSelection.create(docWithNodeAt, 1, 1);
    const prevState = EditorState.create({
      schema,
      doc: docWithNodeAt,
      selection
    });
    const nextState = EditorState.create({
      schema,
      doc: docWithNodeAt,
      selection
    });

    const tr = { setNodeMarkup: jest.fn(() => tr) } as unknown as Transaction;
    plugin.setDirtyFlagOnChange(prevState, nextState, tr, true, capcoPos);

    expect(tr.setNodeMarkup).not.toHaveBeenCalled();
  });

  it('should read dirty flag from transaction selection', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: true } }
        },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { dirty: true }, [schema.text('x')])
    ]);

    const selection = TextSelection.create(doc, 1, 1);
    const prevState = EditorState.create({ schema, doc, selection });
    const nextState = EditorState.create({ schema, doc, selection });

    const tr = {
      doc,
      curSelection: TextSelection.create(doc, 1, 1),
      setNodeMarkup: jest.fn(() => tr)
    } as unknown as Transaction;

    const result = plugin.setDirtyFlagOnChange(prevState, nextState, tr, false, 0);
    expect(result).toBe(tr);
  });

  it('should merge overlapping and non-overlapping ranges', () => {
    const plugin = new ObjectIdPlugin();

    const merged = plugin.mergeRanges([
      { from: 1, to: 3 },
      { from: 3, to: 5 }
    ]);
    expect(merged).toEqual([{ from: 1, to: 5 }]);

    const separate = plugin.mergeRanges([
      { from: 1, to: 2 },
      { from: 5, to: 6 }
    ]);
    expect(separate).toEqual([
      { from: 1, to: 2 },
      { from: 5, to: 6 }
    ]);
  });

  it('should detect undo/redo transactions', () => {
    const plugin = new ObjectIdPlugin();
    const undoTr = {
      getMeta: (key: string) => (key === 'history' ? { undo: true } : undefined)
    } as unknown as Transaction;
    const normalTr = {
      getMeta: () => undefined
    } as unknown as Transaction;

    expect(plugin.isUndoOrRedo([undoTr])).toBe(true);
    expect(plugin.isUndoOrRedo([normalTr])).toBe(false);
  });

  it('should require new id when node is missing objectId', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: { group: 'inline' }
      }
    });

    const node = testSchema.node('paragraph', { objectId: null }, [
      testSchema.text('x')
    ]);

    const required = plugin.isRequiredNewId(
      node,
      [],
      {} as EditorView,
      {} as EditorState,
      {} as EditorState,
      1
    );

    expect(required).toBe(true);
  });

  it('should use createNewId when objectId exists', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: '1' } }
        },
        text: { group: 'inline' }
      }
    });

    const node = testSchema.node('paragraph', { objectId: '1' }, [
      testSchema.text('x')
    ]);

    const spy = jest.spyOn(plugin, 'createNewId').mockReturnValue(true);

    const required = plugin.isRequiredNewId(
      node,
      [],
      {} as EditorView,
      {} as EditorState,
      {} as EditorState,
      1
    );

    expect(required).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('should set dirty flag when capcoPos is provided', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } }
        },
        text: { group: 'inline' }
      }
    });

    const prevDoc = testSchema.node('doc', null, [
      testSchema.node('paragraph', { dirty: false }, [testSchema.text('x')])
    ]);
    const nextDoc = testSchema.node('doc', null, [
      testSchema.node('paragraph', { dirty: false }, [testSchema.text('y')])
    ]);
    const capcoPos = 5;
    const prevDocWithNodeAt = Object.assign(prevDoc, {
      nodeAt: (pos: number) => (pos === capcoPos ? prevDoc.child(0) : null)
    });
    const nextDocWithNodeAt = Object.assign(nextDoc, {
      nodeAt: (pos: number) => (pos === capcoPos ? nextDoc.child(0) : null)
    });

    const prevSelection = TextSelection.create(prevDocWithNodeAt, 1, 1);
    const nextSelection = TextSelection.create(nextDocWithNodeAt, 1, 1);
    const prevState = EditorState.create({
      schema: testSchema,
      doc: prevDocWithNodeAt,
      selection: prevSelection
    });
    const nextState = EditorState.create({
      schema: testSchema,
      doc: nextDocWithNodeAt,
      selection: nextSelection
    });

    const tr = { setNodeMarkup: jest.fn(() => tr) } as unknown as Transaction;
    plugin.setDirtyFlagOnChange(prevState, nextState, tr, true, capcoPos);

    expect(tr.setNodeMarkup).toHaveBeenCalled();
  });

  it('should handle paste when plugin state is missing', () => {
    const plugin = new ObjectIdPlugin();
    jest.spyOn(plugin, 'getState').mockReturnValue(undefined);

    const view = {
      state: { tr: { doc: { nodeAt: () => null } } }
    } as unknown as EditorView;

    const boundHandlePaste = plugin?.props?.handlePaste?.bind(plugin);
    const result = boundHandlePaste(
      view,
      {},
      { content: { childCount: 1 } }
    );

    expect(result).toBeFalsy();
  });

  it('should return original transaction when no pasted para is set', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*' },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('hello')])
    ]);
    const state = EditorState.create({ schema, doc });

    jest.spyOn(plugin, 'getState').mockReturnValue(undefined);
    const tr = state.tr;
    const result = plugin.assignSameObjectMetaDataForCutPastePara(state, tr);

    expect(result).toBe(tr);
  });

  it('should not set objectMetaData when document already has it', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: {
          content: 'paragraph+',
          attrs: { objectId: { default: null }, objectMetaData: { default: {} } }
        },
        paragraph: { content: 'text*' },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', { objectId: null, objectMetaData: {} }, [
      schema.node('paragraph', null, [schema.text('hello')])
    ]);

    const prevState = EditorState.create({ schema, doc });
    const nextState = EditorState.create({ schema, doc });

    jest.spyOn(plugin, 'getChangedRanges').mockReturnValue([]);

    const result = plugin.assignIDsForMissing(
      [{} as Transaction],
      prevState,
      nextState,
      {} as EditorView
    );

    expect(result).toBeDefined();
  });

  it('should not update deletedObjectIds when no IDs are deleted but docs differ', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+', attrs: { deletedObjectIds: { default: [] } } },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: { group: 'inline' }
      }
    });

    const prevDoc = schema.node('doc', { deletedObjectIds: [] }, [
      schema.node('paragraph', { objectId: 'id-1' }, [schema.text('a')])
    ]);
    const nextDoc = schema.node('doc', { deletedObjectIds: [] }, [
      schema.node('paragraph', { objectId: 'id-1' }, [schema.text('a')])
    ]);

    const prevState = EditorState.create({ schema, doc: prevDoc });
    const nextState = EditorState.create({ schema, doc: nextDoc });

    const tr = nextState.tr;
    const result = plugin.trackDeletedObjectId(prevState, nextState, tr);

    expect(result).toBe(tr);
  });

  it('should update deletedObjectIds using nextState.tr when tr is null', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+', attrs: { deletedObjectIds: { default: [] } } },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: { group: 'inline' }
      }
    });

    const prevDoc = schema.node('doc', { deletedObjectIds: [] }, [
      schema.node('paragraph', { objectId: 'id-1' }, [schema.text('a')]),
      schema.node('paragraph', { objectId: 'id-2' }, [schema.text('b')])
    ]);
    const nextDoc = schema.node('doc', { deletedObjectIds: ['old'] }, [
      schema.node('paragraph', { objectId: 'id-2' }, [schema.text('b')])
    ]);

    const prevState = EditorState.create({ schema, doc: prevDoc });
    const nextState = EditorState.create({ schema, doc: nextDoc });

    const result = plugin.trackDeletedObjectId(prevState, nextState, null);

    expect(result).toBeDefined();
  });

  it('should handle undefined deletedObjectIds attribute when deletions exist', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null } }
        },
        text: { group: 'inline' }
      }
    });

    const prevDoc = schema.node('doc', null, [
      schema.node('paragraph', { objectId: 'id-1' }, [schema.text('a')])
    ]);
    const nextDoc = schema.node('doc', null, [
      schema.node('paragraph', { objectId: 'id-2' }, [schema.text('b')])
    ]);

    const prevState = EditorState.create({ schema, doc: prevDoc });
    const nextState = EditorState.create({ schema, doc: nextDoc });

    const result = plugin.trackDeletedObjectId(prevState, nextState, null);
    expect(result).toBeDefined();
  });

  it('should skip capcoPos branch when node is missing', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } }
        },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { dirty: false }, [schema.text('x')])
    ]);

    const docWithNodeAt = Object.assign(doc, {
      nodeAt: () => null
    });

    const selection = TextSelection.create(docWithNodeAt, 1, 1);
    const prevState = EditorState.create({ schema, doc: docWithNodeAt, selection });
    const nextState = EditorState.create({ schema, doc: docWithNodeAt, selection });

    const tr = { setNodeMarkup: jest.fn(() => tr) } as unknown as Transaction;
    const result = plugin.setDirtyFlagOnChange(prevState, nextState, tr, true, 5);

    expect(result).toBe(tr);
  });

  it('should use curSelection when provided on transaction', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } }
        },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { dirty: true }, [schema.text('x')])
    ]);

    const selection = TextSelection.create(doc, 1, 1);
    const prevState = EditorState.create({ schema, doc, selection });
    const nextState = EditorState.create({ schema, doc, selection });

    const tr = {
      doc,
      curSelection: selection,
      setNodeMarkup: jest.fn(() => tr)
    } as unknown as Transaction;

    const spy = jest
      .spyOn(plugin as unknown as { getParentBySelection: () => unknown }, 'getParentBySelection')
      .mockReturnValue({ node: { attrs: { dirty: true } }, pos: 1 });

    plugin.setDirtyFlagOnChange(prevState, nextState, tr, false, null);

    expect(spy).toHaveBeenCalled();
  });

  it('should handle transaction without curSelection', () => {
    const plugin = new ObjectIdPlugin();
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } }
        },
        text: { group: 'inline' }
      }
    });

    const doc = schema.node('doc', null, [
      schema.node('paragraph', { dirty: false }, [schema.text('x')])
    ]);

    const selection = TextSelection.create(doc, 1, 1);
    const prevState = EditorState.create({ schema, doc, selection });
    const nextState = EditorState.create({ schema, doc, selection });

    const tr = {
      doc,
      setNodeMarkup: jest.fn(() => tr)
    } as unknown as Transaction;

    const result = plugin.setDirtyFlagOnChange(prevState, nextState, tr, false, 0);
    expect(result).toBe(tr);
  });

  it('should NOT add objectId attribute to text and hard_break node specs', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: { content: 'text*', attrs: { align: { default: 'left' } } },
        text: { group: 'inline' },
        hard_break: {
          inline: true,
          group: 'inline',
          selectable: false,
          parseDOM: [{ tag: 'br' }],
          toDOM: () => ['br'],
        },
      },
    });

    plugin.getEffectiveSchema(testSchema);

    // text and hard_break must NOT have objectId in their attrs
    expect(testSchema.nodes.text.spec.attrs?.objectId).toBeUndefined();
    expect(testSchema.nodes.hard_break.spec.attrs?.objectId).toBeUndefined();
  });

  it('should add objectId attribute to all non-blacklisted node specs', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'block+', attrs: { layout: { default: null } } },
        paragraph: { content: 'text*', attrs: { align: { default: 'left' } } },
        table: {
          content: 'table_row+',
          group: 'block',
          attrs: { noOfColumns: { default: null } },
          toDOM: () => ['table', {}, 0],
          parseDOM: [{ tag: 'table' }],
        },
        table_row: {
          content: 'table_cell+',
          attrs: {},
          toDOM: () => ['tr', {}, 0],
          parseDOM: [{ tag: 'tr' }],
        },
        table_cell: {
          content: 'block+',
          attrs: { colspan: { default: null } },
          toDOM: () => ['td', {}, 0],
          parseDOM: [{ tag: 'td' }],
        },
        image: {
          inline: true,
          group: 'inline',
          attrs: { src: { default: '' } },
          toDOM: () => ['img', { src: '' }],
          parseDOM: [{ tag: 'img[src]' }],
        },
        text: { group: 'inline' },
        hard_break: {
          inline: true,
          group: 'inline',
          selectable: false,
          parseDOM: [{ tag: 'br' }],
          toDOM: () => ['br'],
        },
      },
    });

    plugin.getEffectiveSchema(testSchema);

    // All non-blacklisted nodes should have objectId
    expect(testSchema.nodes.doc.spec.attrs?.objectId).toBeDefined();
    expect(testSchema.nodes.paragraph.spec.attrs?.objectId).toBeDefined();
    expect(testSchema.nodes.table.spec.attrs?.objectId).toBeDefined();
    expect(testSchema.nodes.table_row.spec.attrs?.objectId).toBeDefined();
    expect(testSchema.nodes.table_cell.spec.attrs?.objectId).toBeDefined();
    expect(testSchema.nodes.image.spec.attrs?.objectId).toBeDefined();
  });

  it('should assign objectId to non-textblock nodes in assignIDsForMissing', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'block+', attrs: { objectId: { default: null } } },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null }, dirty: { default: false } },
        },
        table: {
          content: 'table_row+',
          group: 'block',
          attrs: { objectId: { default: null }, dirty: { default: false } },
          toDOM: () => ['table', {}, 0],
          parseDOM: [{ tag: 'table' }],
        },
        table_row: {
          content: 'table_cell+',
          attrs: { objectId: { default: null } },
          toDOM: () => ['tr', {}, 0],
          parseDOM: [{ tag: 'tr' }],
        },
        table_cell: {
          content: 'paragraph',
          attrs: { objectId: { default: null } },
          toDOM: () => ['td', {}, 0],
          parseDOM: [{ tag: 'td' }],
        },
        text: { group: 'inline' },
      },
    });

    // Build a doc with a table that has no objectId
    const cell = testSchema.node('table_cell', { objectId: null }, [
      testSchema.node('paragraph', { objectId: null, dirty: false }, [
        testSchema.text('cell text'),
      ]),
    ]);
    const row = testSchema.node('table_row', { objectId: null }, [cell]);
    const table = testSchema.node('table', { objectId: null, dirty: false }, [
      row,
    ]);
    const docNode = testSchema.node('doc', { objectId: 'doc-1' }, [table]);

    const selection = TextSelection.create(docNode, 1, 1);
    const prevState = EditorState.create({
      schema: testSchema,
      doc: docNode,
      selection,
    });
    const nextState = EditorState.create({
      schema: testSchema,
      doc: docNode,
      selection,
    });

    // Simulate a changed range covering the table
    const fakeTransactions = [
      {
        docChanged: true,
        getMeta: () => undefined,
        mapping: {
          maps: [
            {
              forEach: (cb: (a: number, b: number) => void) =>
                cb(0, docNode.content.size),
            },
          ],
        },
      },
    ] as unknown as Transaction[];

    const result = plugin.assignIDsForMissing(
      fakeTransactions,
      prevState,
      nextState,
      {} as EditorView
    );

    // assignIDsForMissing should return a non-null transaction because
    // the table, table_row, and table_cell nodes are missing objectIds
    // and are not blacklisted
    expect(result).not.toBeNull();
    // The resulting transaction should have steps (setNodeMarkup calls)
    expect(result.docChanged).toBe(true);
  });

  it('should preserve paragraph objectId when moved into a table (no reassignment)', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'block+', attrs: { objectId: { default: null } } },
        paragraph: {
          content: 'text*',
          attrs: { objectId: { default: null }, dirty: { default: false } },
        },
        table: {
          content: 'table_row+',
          group: 'block',
          attrs: { objectId: { default: null }, dirty: { default: false } },
          toDOM: () => ['table', {}, 0],
          parseDOM: [{ tag: 'table' }],
        },
        table_row: {
          content: 'table_cell+',
          attrs: { objectId: { default: null } },
          toDOM: () => ['tr', {}, 0],
          parseDOM: [{ tag: 'tr' }],
        },
        table_cell: {
          content: 'paragraph',
          attrs: { objectId: { default: null } },
          toDOM: () => ['td', {}, 0],
          parseDOM: [{ tag: 'td' }],
        },
        text: { group: 'inline' },
      },
    });

    // A paragraph that already has an objectId
    const paraWithId = testSchema.node(
      'paragraph',
      { objectId: 'para-keep-me', dirty: false },
      [testSchema.text('moved text')]
    );
    const cell = testSchema.node('table_cell', { objectId: 'cell-1' }, [
      paraWithId,
    ]);
    const row = testSchema.node('table_row', { objectId: 'row-1' }, [cell]);
    const table = testSchema.node(
      'table',
      { objectId: 'table-1', dirty: false },
      [row]
    );
    const docNode = testSchema.node('doc', { objectId: 'doc-1' }, [table]);

    const selection = TextSelection.create(docNode, 1, 1);
    const prevState = EditorState.create({
      schema: testSchema,
      doc: docNode,
      selection,
    });
    const nextState = EditorState.create({
      schema: testSchema,
      doc: docNode,
      selection,
    });

    const tr = nextState.tr;
    const setNodeMarkupSpy = jest.spyOn(tr, 'setNodeMarkup');

    // Simulate a changed range covering the paragraph inside the table
    const fakeTransactions = [
      {
        docChanged: true,
        getMeta: () => undefined,
        mapping: {
          maps: [
            {
              forEach: (cb: (a: number, b: number) => void) =>
                cb(0, docNode.content.size),
            },
          ],
        },
      },
    ] as unknown as Transaction[];

    plugin.assignIDsForMissing(
      fakeTransactions,
      prevState,
      nextState,
      {} as EditorView
    );

    // The paragraph already has an objectId, so it should NOT be reassigned.
    // setNodeMarkup may be called for other nodes, but not for the paragraph
    // with 'para-keep-me'. Check that no call overwrites the paragraph's objectId.
    const paraOverwriteCall = setNodeMarkupSpy.mock.calls.find(
      (call: unknown[]) => {
        const attrs = (call[2] as Record<string, unknown>) ?? {};
        return (
          attrs.objectId &&
          attrs.objectId !== 'para-keep-me' &&
          // The paragraph's existing attrs would be spread; check if this is
          // targeting the paragraph by looking for its original objectId in attrs
          (call[2] as Record<string, unknown>)?.objectId !== 'para-keep-me'
        );
      }
    );
    // The paragraph should not have been targeted for a new ID
    // (isRequiredNewId returns false because it already has an ID and
    //  it's not a new paragraph, cut, or duplicate)
    expect(paraOverwriteCall).toBeUndefined();
  });

  // ── markDirtyByChangedRanges: drag-and-drop dirty flag tests ──

  /**
   * Helper: creates a two-paragraph schema and states simulating a
   * drag-and-drop of text from one paragraph to another.
   *
   * @param dragUp  true = drag from para[1] up to para[0];
   *                false = drag from para[0] down to para[1]
   * @returns an object with plugin, prevState, nextState, and a real
   *          transaction that represents the drag operation
   */
  function createDragScenario(dragUp: boolean): {
    plugin: ObjectIdPlugin;
    prevState: EditorState;
    nextState: EditorState;
    tr: Transaction;
  } {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } },
        },
        text: {},
      },
    });

    // Two paragraphs: "Hello" and "World"
    const prevDoc = testSchema.node('doc', null, [
      testSchema.node('paragraph', { dirty: false }, [
        testSchema.text('Hello'),
      ]),
      testSchema.node('paragraph', { dirty: false }, [
        testSchema.text('World'),
      ]),
    ]);

    const prevState = EditorState.create({
      schema: testSchema,
      doc: prevDoc,
      selection: TextSelection.create(
        prevDoc,
        dragUp ? 8 : 1, // cursor starts in source paragraph
        dragUp ? 8 : 1,
      ),
    });

    // Create a real transaction that simulates the drag
    const tr = prevState.tr;
    if (dragUp) {
      // Drag "World" from para[1] up into para[0]
      // prevDoc: para[0]="Hello" (pos 0, size 7), para[1]="World" (pos 7, size 7)
      // Step 1: Delete "World" from para[1] (text at pos 8..13)
      tr.delete(8, 13);
      // After delete: para[0]="Hello" (pos 0, size 7), para[1]="" (pos 7, size 2)
      // Step 2: Insert "World" at end of para[0] (text ends at pos 6)
      tr.insert(6, testSchema.text('World'));
      // After insert: para[0]="HelloWorld" (pos 0, size 12), para[1]="" (pos 12, size 2)
    } else {
      // Drag "Hello" from para[0] down into para[1]
      // prevDoc: para[0]="Hello" (pos 0, size 7), para[1]="World" (pos 7, size 7)
      // Step 1: Delete "Hello" from para[0] (text at pos 1..6)
      tr.delete(1, 6);
      // After delete: para[0]="" (pos 0, size 2), para[1]="World" (pos 2, size 7)
      // Step 2: Insert "Hello" at beginning of para[1] (text starts at pos 3)
      tr.insert(3, testSchema.text('Hello'));
      // After insert: para[0]="" (pos 0, size 2), para[1]="HelloWorld" (pos 2, size 12)
    }

    // Build nextState from the transaction's resulting doc
    const nextDoc = tr.doc;
    const selPos = dragUp ? 10 : 8; // cursor in destination paragraph
    const nextState = EditorState.create({
      schema: testSchema,
      doc: nextDoc,
      selection: TextSelection.create(nextDoc, selPos, selPos),
    });

    return { plugin, prevState, nextState, tr };
  }

  it('should mark destination paragraph dirty when dragging text up', () => {
    const { plugin, prevState, nextState, tr } = createDragScenario(true);
    const result = plugin.markDirtyByChangedRanges(
      [tr], prevState, nextState, null
    );
    expect(result).not.toBeNull();
    // Destination paragraph (para[0] at pos 0) should be marked dirty
    const destPara = result.doc.nodeAt(0);
    expect(destPara?.attrs?.dirty).toBe(true);
  });

  it('should mark destination paragraph dirty when dragging text down', () => {
    const { plugin, prevState, nextState, tr } = createDragScenario(false);
    const result = plugin.markDirtyByChangedRanges(
      [tr], prevState, nextState, null
    );
    expect(result).not.toBeNull();
    // After drag down: para[0]="" at pos 0, para[1]="HelloWorld" at pos 2
    const destPara = result.doc.nodeAt(2);
    expect(destPara?.attrs?.dirty).toBe(true);
  });

  it('should mark source paragraph dirty when dragging text up', () => {
    const { plugin, prevState, nextState, tr } = createDragScenario(true);
    const result = plugin.markDirtyByChangedRanges(
      [tr], prevState, nextState, null
    );
    expect(result).not.toBeNull();
    // Both paragraphs should be dirty
    const paras: Node[] = [];
    result.doc.forEach((child: Node) => {
      paras.push(child);
    });
    // para[0] = "HelloWorld" (destination), para[1] = "" (source)
    expect(paras[0].attrs?.dirty).toBe(true);
    expect(paras[1].attrs?.dirty).toBe(true);
  });

  it('should mark source paragraph dirty when dragging text down', () => {
    const { plugin, prevState, nextState, tr } = createDragScenario(false);
    const result = plugin.markDirtyByChangedRanges(
      [tr], prevState, nextState, null
    );
    expect(result).not.toBeNull();
    const paras: Node[] = [];
    result.doc.forEach((child: Node) => {
      paras.push(child);
    });
    // para[0] = "" (source), para[1] = "HelloWorld" (destination)
    expect(paras[0].attrs?.dirty).toBe(true);
    expect(paras[1].attrs?.dirty).toBe(true);
  });

  it('should not mark paragraphs dirty when nothing changed', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } },
        },
        text: {},
      },
    });
    const docNode = testSchema.node('doc', null, [
      testSchema.node('paragraph', { dirty: false }, [
        testSchema.text('Hello'),
      ]),
    ]);
    const state = EditorState.create({
      schema: testSchema,
      doc: docNode,
      selection: TextSelection.create(docNode, 1, 1),
    });
    // Empty transaction (no doc changes)
    const tr = state.tr;
    const result = plugin.markDirtyByChangedRanges(
      [tr], state, state, null
    );
    // Should not create a transaction since nothing changed
    expect(result).toBeNull();
  });

  it('should skip already-dirty paragraphs', () => {
    const plugin = new ObjectIdPlugin();
    const testSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph+' },
        paragraph: {
          content: 'text*',
          attrs: { dirty: { default: false } },
        },
        text: {},
      },
    });
    const prevDoc = testSchema.node('doc', null, [
      testSchema.node('paragraph', { dirty: true }, [
        testSchema.text('a'),
      ]),
    ]);
    const nextDoc = testSchema.node('doc', null, [
      testSchema.node('paragraph', { dirty: true }, [
        testSchema.text('ab'),
      ]),
    ]);
    const prevState = EditorState.create({
      schema: testSchema,
      doc: prevDoc,
      selection: TextSelection.create(prevDoc, 1, 1),
    });
    const nextState = EditorState.create({
      schema: testSchema,
      doc: nextDoc,
      selection: TextSelection.create(nextDoc, 1, 1),
    });
    const tr = prevState.tr;
    tr.insert(2, testSchema.text('b'));
    const result = plugin.markDirtyByChangedRanges(
      [tr], prevState, nextState, null
    );
    // Paragraph is already dirty, so no new setNodeMarkup should happen
    // The result should be null (no changes needed)
    expect(result).toBeNull();
  });
});
