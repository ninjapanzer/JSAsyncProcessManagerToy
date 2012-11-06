/**
 * @author Paul Scarrone (NuRelm)
 * This is the implementation of a process scheduler/manager for creating
 * and tracking asyncronous JavaScript Processes. Multiple process managers can be defined
 * but they will share a global PID object and no matter how many managers there are PIDs
 * will not collide
 */


/**
 * Id manager for generating unique ids
 */
function IDManager() {
  this.IDs = new Array();
  /**
   * Finds the last used ID and then increments and tracks that id
   * @return Integer the next fresh id is returned
   */
  this.nextID = function() {
    if (this.IDs.length == 0) {
      this.IDs.push(1);
    } else {
      this.IDs.push(this.lastID() + 1);
    }
    return this.lastID();
  };
  /**
   * finds the last used ID
   * @return Integer/null the last used id or null
   */
  this.lastID = function() {
    if (this.IDs != 0) {
      var IDtemp = this.IDs.pop();
      this.IDs.push(IDtemp);
      return IDtemp;
    } else {
      return null;
    }
  };
}
/**
 * Globally unique ids will be provided for all objects of AsyncSequencer
 */
AsyncSequencer.prototype.IDManager = new IDManager();
/**
 * Public dynamic class to manage timed JS processes
 * @member getActiveProcessList
 */
function AsyncSequencer() {
  var pendingQueue = new Array();
  var manager;
  var activeProcessList = "";
  var allProcessList = "";
  var that = this;
  var QueueSort = function(a, b) {
    if (a.priority < b.priority)
      return -1;
    else if (a.priority == b.priority)
      return 0;
    else
      return 1;
  };
  this.getActiveProcessList = function() {
    return activeProcessList;
  };
  this.getAllProcessList = function() {
    return allProcessList;
  };
  /**
   * internal process object constructor with simple self validation
   * @constructor
   * @param Pid Integer
   * @param Func Function
   * @param Args Array
   * @param Interval Integer
   * @param Handler Integer
   */
  var processObj = function(Pid, Func, Args, Interval, Handler) {
    if (typeof (Pid) != "number")
      Pid = -1;
    if (typeof (Func) != "function")
      Func = function() {
      };
    if (typeof (Args) != "object")
      Args = [];
    if (typeof (Interval) != "number")
      Interval = 1000;
    if (typeof (Handler) == "undefined")
      Handler = "";
    this.pid = Pid;
    this.process = Func;
    this.args = Args;
    this.priority = Interval;
    this.processHandler = Handler;
  };
  this.getProcessQueue = function() {
    return pendingQueue;
  };
  /**
   * Places a process in the process queue but doesn't start it.
   * @param Func Function
   * @param Args Array
   * @param Interval Integer
   * @return Process Id of the new Process
   */
  this.enQueueProcess = function(Fualnc, Args, Interval) {
    var startID = this.IDManager.nextID();
    pendingQueue.push(new processObj(startID, Func, Args,
      Interval));
    return startID;
  };
  /**
   * The Same as enQueueProcess except it starts the returned pid as well
   * @see enQueueProcess
   * @param Func
   * @param Args
   * @param Interval
   * @return Process Id of the newly started Process
   */
  this.enQueueStart = function(Func, Args, Interval) {
    var startID = this.IDManager.nextID();
    pendingQueue.push(new processObj(startID, Func, Args, Interval));
    this.startProcess(startID);
    return startID;
  };
  /**
   * Private method to clear any processes whose function property is null
   */
  var removeProcess = function() {
    var tempQueue = new Array();
    for ( var i = 0; i<pendingQueue.length; i++) {
      if (pendingQueue[i].process != null) {
        tempQueue.push(pendingQueue[i]);
      }
    }
    pendingQueue = tempQueue;
  };
  /**
   * Stops and removes the process associated with the PID
   * @param pid Integer
   * @return Boolean if the removal was successful
   */
  this.deQueueProcess = function(pid) {
    for ( var i = 0; i<pendingQueue.length; i++) {
      if (pid == pendingQueue[i].pid) {
        clearInterval(pendingQueue[i].processHandler);
        pendingQueue[i].processHandler = "";
        pendingQueue[i].process = null;
        removeProcess();
        return true;
      }
    }
    return false;
  };
  /**
   * Stops and removes all processes from the queue
   */
  this.deQueueAll = function() {
    for ( var i = 0; i<pendingQueue.length; i++) {
      clearInterval(pendingQueue[i].processHandler);
      pendingQueue[i].processHandler = "";
      pendingQueue[i].process = null;
    }
    removeProcess();
    internalLister();
  };
  /**
   * Stops a process specified by PID but doesn't remove it from the queue
   * @param pid Integer
   * @return Boolean If the process was found and stopped returns true
   */
  this.killProcess = function(pid) {
    for ( var i = 0; i<pendingQueue.length; i++) {
      if (pid == pendingQueue[i].pid) {
        clearInterval(pendingQueue[i].processHandler);
        pendingQueue[i].processHandler = "";
        return true;
      }
    }
    return false;
  };
  /**
   * Stops all active processes removes their processHandler but leaves then Queued
   */
  this.killAll = function() {
    for ( var i = 0; i<pendingQueue.length; i++) {
      if(pendingQueue[i].processHander != ""){
        clearInterval(pendingQueue[i].processHandler);
        pendingQueue[i].processHandler = "";
      }
    }
  };
  
  this.runOnce = function(pid){
    for ( var i = 0; i<pendingQueue.length; i++) {
      if (pid == pendingQueue[i].pid
        && pendingQueue[i].processHandler == "") {
        pendingQueue[i].processHandler = oneTimeExecute(
          pendingQueue[i].process, pendingQueue[i].args);
        this.deQueueProcess(pid);
        return true;
      }
    }
    return false;
  };
  /**
   * Start a queued process that is currently not running
   * @param pid Integer
   * @return Boolean if the process is found and started returns true
   */
  this.startProcess = function(pid) {
    for ( var i = 0; i<pendingQueue.length; i++) {
      if (pid == pendingQueue[i].pid
        && pendingQueue[i].processHandler == "") {
        pendingQueue[i].processHandler = asyncExecute(
          pendingQueue[i].process, pendingQueue[i].args,
          pendingQueue[i].priority);
        return true;
      }
    }
    return false;
  };
  /**
   * Starts all Queued non running processes
   */
  this.spawnProcesses = function() {
    for ( var i = 0; i<pendingQueue.length; i++) {
      if (pendingQueue[i].processHandler == "") {
        pendingQueue[i].processHandler = asyncExecute(
          pendingQueue[i].process, pendingQueue[i].args,
          pendingQueue[i].priority);
      }
    }
  };
  /**
   * Private object representing the Pid and Handler ID of a process
   * @deprecated
   * @constructor
   * @param Pid Integer
   * @param Handler Integer
   */
  var handlerObj = function(Pid, Handler) {
    this.pid = Pid;
    this.handler = Handler;
  };
  /**
   * Gets the process handler object of one or more processes by function name
   * @param funcName
   * @return Array of handlerObj if there are more then one process by the same name
   * @return handlerObj if there is only one process that matches that name
   */
  this.getProcessHandler = function(funcName) {
    var handlers = new Array();
    for ( var i = 0; i<pendingQueue.length; i++) {
      if (funcName == pendingQueue[i].process.prototype.constructor.name) {
        handlers.push(new handlerObj(pendingQueue[i].pid,
          pendingQueue[i].processHandler));
      }
    }
    if (handlers.length > 1) {
      return handlers;
    } else {
      return handlers[0];
    }
  };
  /**
   * Stops all processes of a particular function name
   * @param funcName
   * @return Boolean if the function found and stopped process/processes returns true
   */
  this.stopSpawnedProcess = function(funcName) {
    var somethingDeleted = false;
    for ( var i = 0; i<pendingQueue.length; i++) {
      if (funcName == pendingQueue[i].process.prototype.constructor.name) {
        clearInterval(pendingQueue[i].processHandler);
        pendingQueue[i].processHandler = "";
        somethingDeleted = true;
      }
    }
    return somethingDeleted;
  };
  /**
   * Starts all processes under a single time manager
   * @deprecated
   * @param interval
   * @return
   */
  this.runOnInterval = function(interval) {
    if (typeof (interval) == "undefined") {
      interval = 1000;
    }
    manager = setInterval(function() {
      pendingQueue.sort(QueueSort);
      for ( var i = 0; i<pendingQueue.length; i++) {
        pendingQueue[i].processHandler = asyncExecute(
          pendingQueue[i].process, pendingQueue[i].args);
      // pendingQueue[i].process = null;
      }
    }, interval);
  };
  /**
   * Stops all processes started with runOnInterval
   * @deprecated
   */
  this.stopAll = function() {
    clearInterval(manager);
  };
  /**
   * Private function which executes a given function and its parameters on a unique timer interval
   * This is the core functionality of the process manager
   * arguments that need to update with every execution need to be passed as callback arguments
   * any callback arguments will be executed at each interval
   * @param func Function the process function
   * @param args Array the array of static parameters or dynamic callback functions
   * @param interval Integer Interval time in ms
   * @return Integer the processor that is associated with this interval
   */
  
  var asyncExecute = function(func, args, interval) {
    var busy = false;
    if (typeof (interval) == "undefined") {
      interval = 100;
      var processor = setInterval(function() {
        var exeArgs = new Array();
        for ( var j= 0; j<args.length; j++) {
          if(args[j] != "undefined"){
            if (typeof (args[j]) == "function") {
              exeArgs.push(args[j]());
            } else {
              exeArgs.push(args[j]);
            }
          }else{
            exeArgs = args;
          }
        }
        if (!busy) {
          busy = true;
          func.apply(null, []);
          clearInterval(processor);
          busy = false;
        }
      }, interval);
    } else {
      var processor = setInterval(function() {
        var exeArgs = new Array();
        for ( var j= 0; j<args.length; j++) {
          if(args[j] != "undefined"){
            if (typeof (args[j]) == "function") {
              exeArgs.push(args[j]());
            } else {
              exeArgs.push(args[j]);
            }
          }else{
            exeArgs = args;
          }
        }
        if (!busy) {
          busy = true;
          func.apply(null, exeArgs);
          busy = false;
        }
      }, interval);
    }
    return processor;
  };
  
  var oneTimeExecute = function(func, args){
    var busy = false;
    var processor = setInterval(function(){
      var exeArgs = new Array();
      for ( var j= 0; j<args.length; j++) {
        if(args[j] != "undefined"){
          if (typeof (args[j]) == "function") {
            exeArgs.push(args[j]());
          } else {
            exeArgs.push(args[j]);
          }
        }else{
          exeArgs = args;
        }
      }
      if (!busy) {
        busy = true;
        func.apply(null, exeArgs);
        busy = false;
        clearInterval(this); 
      }
    }, 1);
    return processor;
  };
  /**
   * Builtin Process which keeps track of some of the queue data in a outputable list for convience
   */
  var internalLister = function() {
    that.enQueueStart(function ProcessLister() {
      var list = that.getProcessQueue();
      var listbody = "";
      var fullListBody = "";
      for ( var i = 0; i<list.length; i++) {
        if (list[i].processHandler != "") {
          listbody += list[i].pid + " "
          + list[i].process.prototype.constructor.name + " "
          + list[i].priority + "<br/>\n";
        }
        fullListBody += list[i].pid + " "
        + list[i].process.prototype.constructor.name + " "
        + list[i].priority + "<br/>\n";
      }
      activeProcessList = listbody;
      allProcessList = fullListBody;
    }, [], 2000);
  }
  internalLister();
}