# Weaveworld

Using [Weaveworld](https://github.com/weaveworld/Weaveworld) with [Node.js](https://nodejs.org) and [Express](https://expressjs.com/).

_License for weaveworld Node.js module: MIT._  
_License for Weaveworld: see 'public/LICENSE' file or [here](https://github.com/weaveworld/Weaveworld/blob/master/LICENSE)._
 
**Direct access** for `w.min.js` and `w.css`.
```html
<script src="w.min.js"></script>
<link href="w.css" rel="stylesheet"/>
```

Example:
```js
const app=require('express')(), bodyParser=require('body-parser');
const weaveworld=require('weaveworld')

app.listen(3000);
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// Optional: publishing files from a folder, too
weaveworld.dir=__dirname+'/public';

// Optional: handling REST API requests
app.route('/tasks')
    .get(function(req,res){
        res.send([{name:'Task1'},{name:'Task2'}]);
    });
// ...    

// Optional: handling ONCE-style server calls
weaveworld.op('hello').then(o=>({message:'Hello '+(o.name||'World')+'!'}));
// ...

// Mandatory: set routing
app.all('/*',weaveworld.route);
``` 

**Publishing files from a directory**.

E.g.,
```js
weaveworld.dir=__dirname+'/public';
``` 