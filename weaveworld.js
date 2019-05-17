const fs = require('fs');
const vm = require('vm');


function getCmd(arg) {
  if (typeof (arg) == 'object' && arg) {
    for (var k in arg) { if (k.startsWith('!')) return k.substring(1); }
  }
  return '';
}

var service = {};

function Arg(arg){
  this.arg=arg;
  this.eval=function(cx){ var r={}, rr=null, a=arg.split(','), more=false;
    for(var i=0; i<a.length; ++i){ var s=a[i].trim(), idx; if(i>0) more=true;
      if(!s){ continue;
      }else if((idx=s.indexOf(':'))!=-1){ var e=s.substring(idx+1); s=s.substring(0,idx);
        if(e.match(/^[a-zA-Z_$][a-zA-Z_$0-9]*/)){ rr=cx[e];
        }else{ rr=vm.runInNewContext(e,cx);
        }
      }else{ rr=cx[s];
      }
      if(typeof(rr)!='undefined') r[s]=rr;
    }              
    return more?r:rr;
  }
}

function Steps() {
  this.ok = true;
  this.steps = [];

  this.then = function then(resolve, reject) {
    this.steps.push(typeof(reject)!='undefined' ? [resolve, reject] : [resolve]);
    return this;
  }
  this.catch = function(reject){
    this.then(undefined, reject);
    return this;
  }  
  this.sql = function sql(conn, cmd, arg) {
    var i=1, $conn, $cmd;
    if(typeof(conn)=='string'){ $conn=module.exports.connection; $cmd=conn;
    }else{ ++i; $conn=conn; $cmd=cmd;
    }
    var f = arguments.length > i;
    var fn = (v) => new Promise((resolve, reject) => {
      var $arg = f ? arguments[i] : v, log=module.exports.sqlLog;
      if(typeof($arg)=='function'){ //$arg.call()
      }else if($arg && !Array.isArray($arg)){ $arg=[$arg]; 
      }
      if(Array.isArray($arg)){
        for(var ai=0; ai<$arg.length; ++ai){
          if($arg[ai] instanceof Arg){
            $arg[ai]=$arg[ai].eval(this);
          }
        }
      }
      if(log) log('SQL:', $cmd, $arg);
      $conn.query($cmd, $arg, function (err, res) {
        if (!err){
          if(log) log('RESULT:', $cmd, $arg);
          resolve(res);
        }else{
          if(log) log('ERROR:', $cmd, $arg);
          reject(err);
        }
      })
    })
    return this.then(fn);
  }
  this.start = function start(resolve, reject, arg, state, i) {
    if (typeof (i) == 'undefined') { i = 0; if(typeof(state)=='undefined') state = { } };
    if (i < this.steps.length) { var step=this.steps[i], fn;
      if(state.$ok===false){ fn=step[1]; if(typeof(fn)!='undefined') state.$ok=undefined; 
      }else{ fn=step[0];
      }
      var fn = this.steps[i][state.$ok!==false ? 0 : 1];
      if (typeof (fn) == 'function') {
        var v;
        try {
          v = fn.call(state, arg);
          if (v instanceof Promise) {
            var $this = this;
            v.then(function res(v) {
              $this.start(resolve, reject, v, state, i + 1);
            }, function rej(v) {
              state.$ok = false; $this.start(resolve, reject, v, state, i + 1)
            })
            return;
          }
        } catch (e) {
          state.$ok = false; v = e;
        }
        arg = v;
        this.start(resolve, reject, arg, state, i + 1);
      }
    } else {
      if (state.$ok!==false) resolve(arg);
      else reject(arg);
    }
  }
}

module.exports.dir = null;
module.exports.sqlLog = null;
module.exports.connection = null;
module.exports.PROD = false;
module.exports.op = function (name) {
  var steps = service[name] = new Steps();
  return steps;
};
module.exports.call = function (resolve, reject, cmd, arg) {
  if (!(fn = service[cmd]) instanceof Steps) throw new Error('Undefined service operation: '+cmd);
  fn.start(resolve,reject,arg);
 }; 
module.exports.arg= function(arg){ return new Arg(arg); }

module.exports.route = function (req, res, next) {
  var cmd = getCmd(req.body) || getCmd(req.query);
  if (req.get('Pragma') == 'W$CALL' || !module.exports.PROD && cmd) {
    var arg = {}, pro = arg, fn;
    if (typeof (req.body) == 'object') Object.assign(arg, req.body);
    if (typeof (req.query) == 'object') Object.setPrototypeOf(arg, pro = Object.assign({}, req.query));
    if (typeof (req.params) == 'object') Object.setPrototypeOf(pro, Object.assign({}, req.params));
    if ((fn = service[cmd]) instanceof Steps) {
      fn.start(
        (o) => { if (typeof (o) != 'undefined') res.send(o); },
        (o) => { if (typeof (o) != 'undefined') res.status(400).send(o) },
        arg
      )
    } else {
      res.status(422).send({ _w: 'Undefined service operation `' + cmd + '`' })
    }
  } else {
    var fn = req.path, dir = module.exports.dir; if (!dir) dir = __dirname + '/public';
    fs.access(dir + fn, fs.R_OK, function (err) {
      if (!err) {
        res.sendFile(dir + fn);
      } else if (dir !== __dirname) {
        fs.access(__dirname + '/public' + fn, fs.R_OK, function (err) {
          if (!err) {
            res.sendFile(__dirname + '/public' + fn);
          } else {
            if (next) next();
          }
        })
      } else {
        if (next) next();
      }
    });
  }
}
