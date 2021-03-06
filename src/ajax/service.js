function service(name){
    service.base.call(this);

    var processId = name || $.uid(),
        format = "ku4service_{0}_{1}";

    this._onSuccess = $.observer($.str.format(format, processId, "onSuccess"));
    this._onError = $.observer($.str.format(format, processId, "onError"));
    this._onTimeout = $.observer($.str.format(format, processId, "onTimeout"));
    this._onComplete = $.observer($.str.format(format, processId, "onComplete"));
    this._onAbort = $.observer($.str.format(format, processId, "onAbort"));
    this._lock = $.lock();
    this._noCache = false;
    this._processId = processId;
    this._requestHeaders = $.hash();
    
    this.GET().text().xhr().async().unlock();
}
service.prototype = {
    processId: function(){ return this.get("processId"); },
    verb: function(verb){ return this.property("verb", verb); },
    callType: function(callType){ return this.property("callType", callType); },
    responseType: function(responseType){ return this.property("responseType", responseType); },
    uri: function(uri){ return this.property("uri", uri); },
    contentType: function(contentType){ return this.property("contentType", contentType); },
    setRequestHeader: function(key, value) { this._requestHeaders.update(key, value); return this; },
    maxAttempts: function(maxAttempts){ return this.property("maxAttempts", maxAttempts); },
    cache: function(){ this._noCache = false; return this; },
    noCache: function(){ this._noCache = true; return this; },
    isLocal: function(isLocal){ return this.property("isLocal", isLocal); },
    strategy: function(strategy){
        if($.exists(strategy)) strategy.context(this);
        return this.property("strategy", strategy);
    },
    isAsync: function(){ return /ASYNC/i.test(this.callType()); },
    isPost: function(){ return /POST/i.test(this.verb()); },
    isLocked: function(){ return this._lock.isLocked(); },
    isBusy: function(){ return this._isBusy; },
    
    onSuccess: function(f, s, id){ this._onSuccess.add(f, s, id); return this; },
    onError: function(f, s, id){ this._onError.add(f, s, id); return this; },
    onTimeout: function(f, s, id){ this._onTimeout.add(f, s, id); return this; },
    onComplete: function(f, s, id){ this._onComplete.add(f, s, id); return this; },
    onAbort: function(f, s, id){ this._onAbort.add(f, s, id); return this; },
    removeListener: function(id){
        this._onSuccess.add(id);
        this._onError.add(id);
        this._onComplete.add(id);
        this._onAbort.add(id);
        return this;
    },
    clearListeners: function(){
         this._onSuccess.clear();
        this._onError.clear();
        this._onComplete.clear();
        this._onAbort.clear();
        return this;
    },
    OPTIONS: function(){ return this.verb("OPTIONS"); },
    GET: function(){ return this.verb("GET"); },
    HEAD: function(){ return this.verb("HEAD"); },
    POST: function(){ return this.verb("POST"); },
    PUT: function(){ return this.verb("PUT"); },
    DELETE: function(){ return this.verb("DELETE"); },
    TRACE: function(){ return this.verb("TRACE"); },
    CONNECT: function(){ return this.verb("CONNECT"); },
    
    xhr: function(){ return this.strategy(new xhr()); },
    xss: function(){ return this.strategy(new xss()); },
    cors: function(){ return this.strategy(new cors()); },
    withCredentials: function(){ return this.property("withCredentials", true); },
    withoutCredentials: function(){ return this.property("withCredentials", false); },

    sync: function(){ return this.callType("sync"); },
    async: function(){ return this.callType("async"); },
    text: function(){ return this.responseType("responseText"); },
    xml: function(){ return this.responseType("responseXML"); },
    
    success: function(response){ this._onSuccess.notify(response, this._processId); return this; },
    error: function(response){ this._onError.notify(response, this._processId); return this; },
    timedout: function(time){ this._onTimeout.notify({ message: "Timeout after: " + time }, this._processId); return this; },
    complete: function(response){
        this.abort();
        this._clearTimeout();
        this._onComplete.notify(response, this._processId);
        this._isBusy = false;
        return this;
    },
    
    lock: function(){ this._lock.lock(); return this; },
    unlock: function(){ this._lock.unlock(); return this; },
    timeout: function(value) { this._timeout = value; return this; },
    abort: function(){
        if(!this._isBusy) return this;
        this.strategy().abort();
        this._onAbort.notify(this._params, this._processId);
        return this;
    },
    call: function(params){
        if(this.isLocked()) return this;
        this._isBusy = true;
        this._params = params;
        this.strategy().call(params, this._readSettings());
        this._startTimeout();
        return this;
    },
    _readSettings: function() {
        return {
            "contentType": this._contentType,
            "withCredentials": this._withCredentials,
            "requestHeaders": this._requestHeaders
        }
    },
    _startTimeout: function() {
        if(!this._timeout) return;
        var me = this;
        this._clearTimeout();
        this._timer = setTimeout(function() {
            me.abort();
            me._clearTimeout();
            me.timedout(me._timeout);
        }, this._timeout);
    },
    _clearTimeout: function() {
        if(!this._timer) return;
        clearTimeout(this._timer);
    }
};
$.Class.extend(service, $.Class);
$.service = function(name){ return new service(name); };
$.service.Class = service;

$.service.noCache = function(dto) {
    var noCache = $.dto({"noCache": $.uid()});
    if(!$.exists(dto)) return noCache;
    return dto.merge(noCache);
};
