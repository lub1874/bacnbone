/**
 * Created by bing on 2017/11/1.
 */
//backbone.js 1.3.3

(function ( factory ) {
    var root = ( typeof self === 'object' && self.self === self && self ) ||
        ( typeof global === 'object' && global.global === global && global );

    if ( typeof define === 'function' && define.amd ) {
        define(['underscore', 'jquery', 'exports'], function (_, $, exports) {
            root.Backbone = factory(root, exports, _, $);
        });
    } else if ( typeof exports !== 'undefined' ) {
        var _ = require('underscore'), $;
        try { $ = require('jquery') ;} catch (e) {}

        factory( root, exports, _, $ );
    } else {
        root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
    }
})(function (root, Backbone, _, $) {
    var previousBackbone = root.Backbone;
    var slice = Array.prototype.slice;
    Backbone.VERSION = '1.3.3';
    Backbone.$ = $;

    Backbone.noConflict = function () {
        root.Backbone = previousBackbone;
        return this;
    };

    //如果使用不支持Backbone默认REST/HTTP方式的传统网络服务器，那么可以开启Backbone.emulateHTTP，伪造PUT， Patch，Delete以及Post请求
    Backbone.emulateHTTP = false;

    //如果emulateJSON开启，方法将被传递作为additional _method参数。
    Backbone.emulateJSON = false;
    
   var Events = Backbone.Events = {};
   
   var eventSplitter = /\s+/;
   
   var _listening;

   /*
   * iteratee: 函数，例如绑定：onAPI，解绑：offApi，触发：triggerApi
   * events：已有事件的集合，当前对象上绑定的所有事件
   * name：事件名称，来源于接口传入
   * callback：回调函数，对外接口传入，但是当name是‘object’时，callback可能是context
   * 总的来说，eventsAPI，通过调用对外方法，对多事件进行拆解，遍历执行每一个 （eventName，callback）
   * */
   var eventsApi = function (iteratee, events, name, callback, opts) {
        var i = 0, names;

        if (name && typeof name === 'object') {
            if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
            for (names = _.keys(name); i < names.length; i++) {
                events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
            }

        } else if (name && eventSplitter.test(name)) {
            for (names = name.split(eventSplitter); i < names.length; i++) {
                events = iteratee(events, names[i], callback, opts);
            }
        } else {
            events = iteratee(events, name, callback, opts);
        }

        return events;
   };

   /*
   * 绑定一个事件，如果传入一个all，则会给事件列表中的事件都绑定上callback
   * */
   Events.on = function (name, callback, context) {
       this._events = eventsApi(onApi, this._events || {}, name, callback, {
           context: context,
           ctx: this,
           listening: _listening
       });

       if (_listening) {
           var listeners = this._listeners || (this._listerers = {});
           listeners[_listening.id] = _listening;
           _listening.interop = false;
       }

       return this;
   };

   /*
   * 对其他object的触发事件进行监听
   * */
   Events.listenTo = function (obj, name, callback) {
       if (!obj) return this;
       var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
       var listeningTo = this._listeningTo || (this._listeningTo = {});
       var listening = _listening = listeningTo[id];

       if (!listening) {
           this._listenId || (this._listenId = _.uniqueId("l"));
           listening = _listening = listeningTo[id] = new Listening(this, obj);
       }

       var error = tryCatchOn(obj, name, callback, this);
       _listeing = void 0;

       if (error) throw error;

       if (listening.interop) listening.on(name, callback);

       return this;
   };

   /*
   * 给事件绑定回调函数
   * */
   var opApi = function (events, name, callback, options) {
       if (callback) {
           var handlers = events[name] || (events[name] = []);
           var context = options.context, ctx = options.ctx, listening = options.listening;

           if (listening) listening.count++;

           handlers.push({callback: callback, context: context, ctx: context || ctx, listening: listening})
       }
       return events;
   };

   var tryCatOn = function (obj, name, callback, context) {
       try {
           obj.on(name, callback, context);
       } catch (e) {
           return e;
       }
   };

   /*
   * 解除绑定
   * 如果context为空，移除函数中所有的回调函数
   * 如果callback为空，则移除事件上所有的回调函数
   * 如果name为空，则移除所有的事件
   * */
   Events.off = function (name, callback, context) {
       if (!this._events) return this;

       this._events = eventsApi(offApi, this._events, name, callback, {
           context: context,
           listeners: this._listerers
       });

       return this;
   };

   /*
   * 对象停止监听事件
   * */
   Events.stopListening = function (obj, name, callback) {
       var listeningTo = this._listeningTo;

       if (!listeningTo) return this;

       var ids = obj ? [obj._listenId] : _.keys(listeningTo);
       for (var i = 0; i < ids.length; i++) {
           var listening = listeningTo[ids[i]];

           if (!listening) break;

           listening.obj.off(name, callback, this);
           if (listening.interop) listening.off(name, callback);
       }

       if (_.isEmpty(listeningTo)) this._listeningTo = void 0;

       return this;
   };

   Events.offApi = function (events, name, callback, options) {
       if (!events) return;
       var context = options.context, listeners = options.listeners;
       var i = 0, names;

       if (!name && !context && !callback) {
           for (names = _.keys(listeners); i < names.length; i++) {
               listeners[names[i]].cleanup();
           }
           return;
       }

       names = name ? [name] : _.keys(events);

       for (; i < names.length; i++) {
           name = names[i];
           var handlers = events[name];

           if (!handlers) break;

           var remaining = [];

           for (var j = 0; j < handlers.length; j++) {
               var handler = handlers[j];
               if (
                   callback && callback !== handler.callback &&
                   callback !== handler.callback._callback ||
                   context && context !== handler.context
               ) {
                   remaining.push(handler);
               } else {
                   var listening = handler.listening;
                   if (listening) listening.off(name, callback);
               }
           }

           if (remaining.length) {
               events[name] = remaining;
           } else {
               delete events[name];
           }
       }

       return events;
   };

   Events.once = function (name, callback, context) {
       var events = eventsApi(onceMap, {}, name, callback, _.bind(this.off, this));
       if (typeof  name === 'string' && context == null) callback = void 0;
       return this.on(events, callback, context);
   };

   Events.listenToOnce = function (obj, name, callback) {
       var events = eventsApi(onceMap, {}, name, callback, _.bind(this.stopListening, this, obj));
       return this.listenTo(obj, events);
   };

   var onceMap = function (map, name, callback, offer) {
       if (callback) {
           var once = map[name] = _.once(function () {
               offer(name, once);
               callback.apply(this, arguments);
           });
           once._callback = callback;
       }

       return map;
   };

   Events.trigger = function (name) {
       if (!this._events) return this;

       var length = Math.max(0, arguments.length);
       var args = Array(length);
       for (var i= 0; i < length; i++) args[i] = arguments[i + 1];

       eventsApi(triggerApi, this._events, name, void 0, args);
       return this;
   };

   var triggerApi = function (objEvents, name, callback, args) {
       if (objEvents) {
           var events = objEvents[name];
           var allEvents = objEvents.all;

           if (events && allEvents) allEvents = allEvents.slice();
           if (events) triggerEvents(events, args);
           if (allEvents) triggerEvents(allEvents, [name].concat(args));
       }

       return objEvents;
   };

   var triggerEvents = function (events, args) {
       var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];

       switch (args.length) {
           case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
           case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
           case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
           case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
           default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;           
       }
   };
   
   var Listening = function (listener, obj) {
       this.id = listener._listenId;
       this.listener = listener;
       this.obj = obj;
       this.interop = true;
       this.count = 0;
       this._events = void 0;
   };
   
   Listening.prototype.on = Events.on;
   
   Listening.prototype.off = function (name, callback) {
       var cleanup;
       if (this.interop) {
           this._events = eventsApi(offApi, this._events, name, callback, {
               context: void 0,
               listeners: void 0
           });
           cleanup = !this._events;
       } else {
           this.count--;
           cleanup = this.count === 0;
       }

       if (cleanup) this.cleanup();
   };

   Listening.prototype.cleanup = function () {
       delete this.listener._listeningTo[this.obj._listenId];
       if (!this.interop) delete this.obj._listerers[this.id];
   };

   Events.bind = Events.on;
   Events.unbind = Events.off;

   _.extend(Backbone, Events);

   /*
   * Model相关
   * */
   var Model = Backbone.Model = function (attributes, options) {
       var attrs = attributes || {};
       options || (options = {});
   }
});
