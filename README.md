# ObjectId ProseMirror Plugin For Licit

Plugin allows to autogenerate object id for every Artifacts and track deleted artifacts

### Commands

- npm install

- npm pack

#### To use this in Licit

Run these commands before npm install.

- npm install @modusoperandi/licit-object-id

Include plugin in licit component

- import objectIdPlugin

- add objectIdPlugin instance in licit's plugin array

```

import  ObjectIdPlugin  from  '@modusoperandi/licit-object-id';


const  plugins = [new  ObjectIdPlugin()]

ReactDOM.render(<Licit docID={0} plugins={plugins}/>


```
