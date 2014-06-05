(function(l){
function service(){
    service.base.call(this);
    this._processId = $.uid("svc");
    this._onSuccess = $.observer();
    this._onError = $.observer();
    this._onComplete = $.observer();
    this._lock = $.lock();
    this._noCache = false;
    this._isLocal = false;
    
    this.GET().text().xhr().async().unlock();
}
service.prototype = {
    processId: function(){ return this.get("processId"); },
    verb: function(verb){ return this.property("verb", verb); },
    callType: function(callType){ return this.property("callType", callType); },
    responseType: function(responseType){ return this.property("responseType", responseType); },
    uri: function(uri){ return this.property("uri", uri); },
    contentType: function(contentType){ return this.property("contentType", contentType); },
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
    onComplete: function(f, s, id){ this._onComplete.add(f, s, id); return this; },    
    removeListener: function(id){
        this._onSuccess.add(id);
        this._onError.add(id);
        this._onComplete.add(id);
        return this;
    },
    clearListeners: function(){
         this._onSuccess.clear();
        this._onError.clear();
        this._onComplete.clear();
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
    sync: function(){ return this.callType("sync"); },
    async: function(){ return this.callType("async"); },
    text: function(){ return this.responseType("responseText"); },
    xml: function(){ return this.responseType("responseXML"); },
    
    success: function(response){ this._onSuccess.notify(response, this._processId); return this; },
    error: function(response){ this._onError.notify(response, this._processId); return this; },
    complete: function(response){
        this._onComplete.notify(response, this._processId);
        this._isBusy = false;
        return this;
    },
    
    lock: function(){ this._lock.lock(); return this; },
    unlock: function(){ this._lock.unlock(); return this; },
    
    abort: function(){
        if(!this._isBusy) return this;
        this.strategy().abort();
        return this;
    },
    call: function(params){
        if(this.isLocked()) return this;
        this._isBusy = true;
        this.strategy().call(params, this._readSettings());
        return this;
    },
    _readSettings: function() {
        return { "contentType": this._contentType }
    }
}
$.Class.extend(service, $.Class);
$.service = function(){ return new service(); }

$.service.noCache = function(dto) {
    var noCache = $.dto({"noCache": $.uid()});
    if(!$.exists(dto)) return noCache;
    return dto.merge(noCache);
}

function xhr(){
    xhr.base.call(this);
    this._isOk = function(status){ return /[23]\d{2}/.test(status) || this.context().isLocal(); }
    this._isAborted = function(status){ return !/\d{3}/.test(status); }
    this._attempts = 0;
}
xhr.prototype = {
    context: function(context){ return this.property("context", context); },
    abort: function(){
        try { this._xhr.abort(); }
        catch(e){ /*Fail*/ }
    },
    call: function(params, settings){
        this._xhr = xhr_createXhr();
        var paramsExist = $.exists(params),
            context = this.context(),
            isPost = context.isPost(),
            hasQuery = !isPost && paramsExist,
            noCache = context._noCache,
            cacheParam = $.str.format("__ku4nocache={0}", $.uid()),
            postParams = (isPost) ? params : null,
            paramLength = (paramsExist) ? params.length : 0,
            format = (hasQuery && noCache) ? "{0}?{1}&{2}" : hasQuery ? "{0}?{1}" : noCache ? "{0}?{2}" : "{0}",
            xhr = this._xhr,
            me = this;

        if(!$.exists(xhr)) context.error(new Error("Ajax not supported")); 
        xhr.open(context.verb(), $.str.format(format, context.uri(), params, cacheParam), context.isAsync());
        
        if(isPost){
            var contentType = (!settings.contentType) ? "application/x-www-form-urlencoded" : settings.contentType;
            xhr.setRequestHeader("Content-type", contentType);
            xhr.setRequestHeader("Content-length", paramLength);
            xhr.setRequestHeader("Connection", "close");
        }

        xhr.onreadystatechange = function(){
            if(xhr.readyState > 3) {
                var response = xhr[context.responseType()],
                    status = xhr.status;
                if(me._isAborted(status)) return;
                if(me._isOk(status)){
                    context.success(response).complete(response);
                    return;
                }
                if(me._attempts < context.maxAttempts()) {
                    me.call(params);
                    return;
                }
                context.error(response).complete(response);
            }
        }
        if($.exists(postParams)) xhr.send(postParams);
        else xhr.send();
    }
}
$.Class.extend(xhr, $.Class);

function xhr_createXhr(){
    return ($.exists(XMLHttpRequest))
        ? new XMLHttpRequest()
        : ($.exists(window.ActiveXObject))
            ? (function(){
                    var v = ["MSXML2.Http6.0", "MSXML2.Http5.0", "MSXML2.Http4.0", "MSXML2.Http3.0", "MSXML2.Http"];
                    for(var n in v) {
                        try{ return new ActiveXObject(v[n]); }
                        catch(e){ }
                    }
                    return null;
                })()
            : null;
}

function xss(){
    xss.base.call(this);
    this._head = document.documentElement.getElementsByTagName("head")[0];
}
xss.prototype = {
    context: function(context){ return this.property("context", context); },
    abort: function(){
        try { this._head.removeChild(this._script); }
        catch(e){ /*Fail*/ }
    },
    call: function(params){
        var context = this.context(),
            head = document.documentElement.getElementsByTagName("head")[0],
            format = "{0}?ku4jXssOnSuccess=kodmunki.{1}&ku4jXssOnError=kodmunki.{2}&ku4jXssOnComplete=kodmunki.{3}{4}",
            procId = context.processId(),
            success = procId + "_success",
            error = procId + "_error",
            complete = procId + "_complete",
            parameters = ($.exists(params)) ? "&" + params : "",
            location = $.str.format(format, context.uri(), success, error, complete, parameters);
            
        this._script = $.create({script:{src:location, language:"javascript", type:"text/javascript"}});

        kodmunki[success] = function(){ context.success.apply(context, arguments); };
        kodmunki[error] = function(){ context.error.apply(context, arguments); };
        kodmunki[complete] = function(){ context.complete.apply(context, arguments); };
            
        this._head.appendChild(this._script);
    }
}
$.Class.extend(xss, $.Class);

function cookie() { cookie.base.call(this); }
cookie.prototype = {
    name: function(name) { return this.property("name", name); },
    expires: function(expires) { return this.property("expires", expires); },
    domain: function(domain) { return this.property("domain", domain); },
    path: function(path) { return this.property("path", path); },
    isSecure: function(isSecure) { return this.property("isSecure", isSecure); },
    erase: function() {
        this.expires(new Date("1/1/2000"));
        this.save();
        return this;
    },
    save: function(obj) {
        document.cookie = $.cookie.serialize(obj,
            {   name: this._name,
                expires: this._expires,
                path: this._path,
                domain: this._domain,
                isSecure: this._isSecure } );
        return this;
    }
};
$.Class.extend(cookie, $.Class);

$.cookie = function(params){
    var p = params || {},
        o = ($.isString(p))
            ? cookie_defaultParams.replicate().merge({name:p}).toObject()
            : cookie_defaultParams.replicate().merge(p).toObject();
    return (new cookie())
                .name(o.name)
                .expires(o.expires)
                .path(o.path)
                .domain(o.domain)
                .isSecure(o.isSecure);
};
$.cookie.Class = cookie;

$.cookie.erase = function(name){
    $.cookie.load(name).erase();
};

$.cookie.load = function(name){
    var o = ($.isObject(name)) ? name : { name: name };
        p = cookie_defaultParams.replicate().merge(o).toObject()
    return $.cookie(p);
};

$.cookie.find = function(name){
    var c = document.cookie.split("; "), i = c.length;
    while (i--) {
        var cke = c[i].split("=");
        if (cke[0] === name) return c[i];
    }
    return null;
};

$.cookie.serialize = function(obj, params) {
    var pms = params || {},
        o = cookie_defaultParams.replicate().merge(pms).toObject(),
        n = o.name,
        e = o.expires,
        p = o.path,
        d = o.domain,
        s = o.isSecure,
        I = cookie_buildInfoPair(n, escape($.json.serialize(obj))),
        E = ($.isDate(e)) ? cookie_buildInfoPair("; expires", e.toGMTString()) : "",
        P = (!p) ? "" : cookie_buildInfoPair("; path", escape(p)),
        D = (!d) ? "" : cookie_buildInfoPair("; domain", escape(d)),
        S = (!s) ? "" : "; secure";
    return I + E + P + D + S;
};

$.cookie.deserialize = function(cookie) {
    try {
        var ck = (/;/.test(cookie))
            ? cookie.substring(0, cookie.search(";")).split("=")
            : cookie.split("="),
            kv = { key: ck[0], value: ck[1] };
        return $.json.deserialize(unescape(kv.value));
    }
    catch(e){ throw $.exception("arg", $.str.format("Cannot deserialize {0}", cookie)); }
};

var cookie_defaultParams = $.hash({name:$.uid("COOKIE"),
                expires: $.dayPoint.today().nextYear().toDate(),
                path:"/",
                domain:null,
                isSecure:false });
var cookie_buildInfoPair = function(k, v) { return k + "=" + v; };

function dto(obj) {
    this._isArray = ($.isArray(obj) || obj instanceof $.list.Class);
    dto.base.call(this, obj);
}
dto.prototype = {
    name: function(name){ return this.set("name", name); },
    toJson: function() { return $.json.serialize(this.toObject()); },
    toQueryString: function() { return $.queryString.serialize(this.$h); },

    saveAs: function(name) {
        if(!name) throw $.exception("arg", "$.dto.saveAs requires a name");
        $.cookie(name).save(this.$h);
        this._name = name;
        return this;
    },
    save: function(){
        var name = this._name || $.uid("dto");
        this.saveAs(name);
        return name;
    },
    erase: function(){
        var name = this._name;
        if($.exists(name)) $.cookie.erase(name);
        return this;
    },
    replicate: function(){ return $.dto($.replicate(this.$h)); },
    toObject: function() { return (this._isArray) ? this.values() : this.$h; },
    filter: function() {
        return $.dto(dto.base.prototype.filter.apply(this, arguments));
    }
};
$.Class.extend(dto, $.hash.Class);

$.dto = function(obj){ return new dto(obj); };
$.dto.Class = dto;

$.dto.parseJson = function(str) { return $.dto($.json.deserialize(str)); };
$.dto.parseQueryString = function(str) { return $.dto($.queryString.deserialize(str)); };
$.dto.serialize = function(name) {
    try { return new dto($.cookie.deserialize($.cookie.find(name))).name(name); }
    catch(e) { return null; }
};

if(!$.exists($.json)) $.json = {};
$.json.serialize = function(obj) {
    if ($.isUndefined(obj)) return undefined;
    if ($.isNull(obj)) return null;
    if (!$.isArray(obj) && !$.isObject(obj))
        return obj.toString();
    var r = [],
        f = ($.isArray(obj)) ? "[{0}]" : "{{0}}";
    for (var n in obj) {
        var o = obj[n];
        if ($.isUndefined(o) && $.isFunction(o)) continue;
        var v = ($.isNumber(o))
                ? o
                : ($.isDate(o))
                ? '"' + $.dayPoint.parse(o).toJson() + '"'
                : ($.isString(o))
                ? '"' + json_serializeString(o) + '"'
                : $.json.serialize(o);
         if($.isUndefined(v)) continue;
        r[r.length] = (($.isObject(obj) && !$.isArray(obj))
            ? ("\"" + n + "\"" + ":")
            : "") + v;
    }
    return $.str.format(f, r);
};
$.json.deserialize = function(str) {
    try {
        var obj = ($.isString(str)) ? eval("(" + json_deserializeString(str) + ")") : str;
        if(!$.exists(obj)) return obj;
        if($.isNullOrEmpty(obj.tagName) &&
            ($.isObject(obj) || $.isArray(obj))) {
            for (var n in obj) {
                var value = obj[n];
                if ($.isObject(value) || $.isArray(value)) obj[n] = $.json.deserialize(value);
                if(/\d{4}\-\d{2}\-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(value) && $.dayPoint.canParse(value)) {
                    obj[n] = $.dayPoint.parse(value).toDate();
                }
            }
            return obj;
        }
        return (/\d{4}\-\d{2}\-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(obj))
                ? $.dayPoint.parse(obj).toDate()
                : obj;
    }
    catch (e) { return str; }
};

function json_serializeString(str) {
    return str
        .replace(/\\/g,"\\\\")
        .replace(/\"/g,"\\\"")
        .replace(/\//g,"\/")
        .replace(/\f/g,"\\f")
        .replace(/\n/g,"\\n")
        .replace(/\r/g,"\\r")
        .replace(/\t/g,"\\t");
}
function json_deserializeString(str) {
    return str
        .replace(/\\\//g,"/")
        .replace(/\\\\f/g,"\\f")
        .replace(/\\\\n/g,"\\n")
        .replace(/\\\\r/g,"\\r")
        .replace(/\\\\t/g,"\\t");
}

if(!$.exists($.queryString)) $.queryString = {};
$.queryString.serialize = function(obj) {
    var result = "";
    $.hash(obj).each(function(item){
        var value = item.value,
            serializeValue = $.isDate(value) ? $.dayPoint.parse(value).toJson() : value;
        result += $.str.format("&{0}={1}", encodeURIComponent(item.key), encodeURIComponent($.json.serialize(serializeValue)));
    });
    return result.replace(/^\&/, "");
};
$.queryString.deserialize = function(str) {
    if(!/\??\w+=\w+/.test(str)) return;
    var queryString = str.replace(/.*\?/, ""),
        keyValuePairs = queryString.split("&"),
        result = $.hash();

    $.list(keyValuePairs).each(function(item) {
        var pair = item.split("="),
            key = pair[0],
            value = pair[1],
            deserializeValue = (/^null$|^true$|^false$|^\d+(\.\d+?)?$|^\[.*\]$|^\{.*\}$/.test(value))
                                ? value
                                : '"' + value + '"';

        result.add(decodeURIComponent(key), $.json.deserialize(decodeURIComponent(deserializeValue)));
    });

    return result.toObject();
};

function abstractField(){
    abstractField.base.call(this);
    this._onIsValid = $.observer();
    this._onInvalid = $.observer();
    this.spec($.spec(function(){ return true; }))
        .optional();
}
abstractField.prototype = {
    $read: function(){ return; },
    $write: function(){ return; },
    $clear: function(){ return; },
    value: function(value){
        if(!$.exists(value)) return this.$read();
        this.$write(value);
        return this;
    },
    clear: function(){ return this.$clear(); },
    optional: function(){ this._optionSpec = $.fields.specs.optional; this._operand = "or"; return this; },
    required: function(){ this._optionSpec = $.fields.specs.required; this._operand = "and"; return this; },
    spec: function(spec){ return this.property("spec", spec); },
    isValid: function(){
        var b = this._optionSpec[this._operand](this.spec()).isSatisfiedBy(this.value()),
            o = (b) ? this._onIsValid : this._onInvalid;
        o.notify(this);
        return b;
    },
    isEmpty: function(){ return $.isEmpty(this.value()); },
    onIsValid: function(f, s, id){ this._onIsValid.add(f, s, id); return this; },
    onInvalid: function(f, s, id){ this._onInvalid.add(f, s, id); return this; }
 }
$.Class.extend(abstractField, $.Class);

function field(selector){
    field.base.call(this);

    var query = $(selector);
    if(query.length > 1)
        throw $.ku4exception("$.field", $.str.format("Invalid DOM selector= {0}. Requires unique node", selector));
    if(!$.exists(query[0]))
        throw $.ku4exception("$.field", $.str.format("Invalid DOM selector= {0}", selector));
    this.dom(query[0])
        .spec($.spec(function(){ return true; }))
        .optional();
}
field.prototype = {
    $read: function(){ return this.dom().value },
    $write: function(value){ this.dom().value = value; },
    $clear: function(){ this.dom().value = ""; return this; },
    dom: function(dom){ return this.property("dom", dom); }
 }
$.Class.extend(field, abstractField);
$.field = function(selector){ return new field(selector); }
$.field.Class = field;

function checkbox(selector){
    checkbox.base.call(this, selector);
}
checkbox.prototype = {
    $read: function(){
        var d = this.dom();
        return (d.checked) ? d.value : "";
    },
    $write: function(value){
        var d = this.dom();
        d.checked = (d.value == value);
    },
    $clear: function(){ this.uncheck(); return this; },
    check: function(){ this.dom().checked = true; return this; },
    uncheck: function(){ this.dom().checked = false; return this; }
}
$.Class.extend(checkbox, field);
$.checkbox = function(dom){ return new checkbox(dom); }
$.checkbox.Class = checkbox;

function radioset(){
    radioset.base.call(this);
    this._radios = $.list();
}
radioset.prototype = {
    $read: function(){
        var rv = [];
        this._radios.each(function(r){ if(r.checked) rv.push(r.value); });
        return rv.toString();
    },
    $write: function(value){
        var v = ($.isString(value)) ? value.split(",") : value,
            vlist = $.list(v);
        this._radios.each(function(r){ r.checked = vlist.contains(r.value); });
    },
    $clear: function(){
        this._radios.each(function(r){ r.checked = false; });
    },
    add: function(dom){
        this._radios.add(dom);
        return this;
    },
    listNodes: function(){ return this._radios; } 
}
$.Class.extend(radioset, abstractField);
$.radioset = function(){ return new radioset(); }
$.radioset.Class = radioset;

function select(selector){
    select.base.call(this, selector);
    this._opts = function(){ return $.list(this.dom().options); }
    if(this.dom().multiple) this.multiple();
    else this.single();
}
select.prototype = {
    $read: function(){
        var rv = [];
        this._opts().each(function(opt){ if(opt.selected) rv.push(opt.value); });
        return rv.toString();
    },
    $write: function(value){
        return (this._multiple) ? select_writeMultiple(this, value) : select_writeSingle(this, value);
    },

    multiple: function(){ this._multiple = true; return this; },
    single: function(){ this._multiple = false; return this; },
	addOptgroup: function(){
		this.dom().appendChild(document.createElement('optgroup'));
		return this;
	},
    addOption: function(k, v, index, isOptGroup){
        var dom = this.dom(),
            option = document.createElement('option'),
            idx = index || null,
            opt = ($.exists(idx)) ? dom.options[idx] : null;
        option.text = k;
        option.value = v;
		
		if(isOptGroup) 
			dom.getElementsByTagName("optgroup")[index].appendChild(option)
		else {
			try { dom.add(option, opt); }
			catch(ex) { dom.add(option, idx); }
		}
        return this;
    },
    removeOption: function(index){
      this.dom().remove(index);
      return this;
    }
}
$.Class.extend(select, field);
$.select = function(dom){ return new select(dom); }
$.select.Class = select;

function select_writeSingle(select, value){
    select._opts().each(function(opt){
        opt.selected = (opt.value == value);
    });
    return select;
}
function select_writeMultiple(select, value){
    var v = ($.isString(value)) ? value.split(",") : value,
        vlist = $.list(v);
    select._opts().each(function(opt){
        opt.selected = vlist.contains(opt.value);
    });
    return select;
}

function form(){
    form.base.call(this);
    this._onSubmit = $.observer();
    this._fields = $.hash();
}
form.prototype = {
    $submit: function(){ return; },
    name: function(name){ return this.property("name", name); },
    fields: function(){ return this._fields; },
    listFields: function(){ return $.list(this._fields.values()); },
    findField: function(name){ return this._fields.findValue(name); },
    isEmpty: function(){
        var v = true;
        $.list(this._fields.values()).each(function(f){ if(!f.isEmpty()) v = false; });
        return v;
    },
    isValid: function(){
        var v = true;
        $.list(this._fields.values()).each(function(f){ if(!f.isValid()) v = false; });
        return v;
    },
    submit: function(){
        var values = this.read();
        this._onSubmit.notify(this);
        this.$submit(values);
    },
    onSubmit: function(f, s, id){ this._onSubmit.add(f, s, id); return this; },
    add: function(n, f){ this._fields.add(n, f); return this; },
    remove: function(n){ this._fields.remove(n); return this; },
    clear: function(){
        this._fields.each(function(f){ f.value.clear(); });
        return this;
    },
    read: function(){
        var dto = $.dto();
        this._fields.each(function(o){
            var k = o.key, v = o.value;
            if($.exists(v.read)) dto.merge(v.read());
            if($.exists(v.value)) dto.add(k, v.value());
        });
        return dto;
    },
    write: function(obj){
        if(!$.exists(obj)) return this;
        var dto = ($.exists(obj.toObject)) ? obj : $.dto(obj)
        this._fields.each(function(o) {
            var field = o.value;
            if($.exists(field.write)) field.write(dto);
            if($.exists(field.value)) field.value(dto.find(o.key));
        });
        return this;
    },
    saveAs: function(name){
        this.read().saveAs(name);
        this._name = name;
        return this;
    },
    save: function(){
        var name = this._name || $.uid("form");
        this.saveAs(name);
        return name;
    },
    erase: function(){
        var name = this._name;
        if($.exists(name)) $.dto.serialize(name).erase();
        return this;
    },
    load: function(name){
        if($.isString(name)) this._name = name;
        var n = this._name;
        return ($.exists(n)) ? this.write($.dto.serialize(n)) : this;
    }
}
$.Class.extend(form, $.Class);
$.form = function() { return new form(); }
$.form.Class = form;

$.fields = {
    specs: (function(){
        var value = {};
        try {
            value.required = $.spec(function(v){ return (!$.isNullOrEmpty(v)) && /^.+$/.test(v); }),
            value.optional = $.spec(function(v){ return $.isNullOrEmpty(v); }),
            
            value.currency = $.spec(function(v){ return /^[\w\$]?(\d+|(\d{1,3}(,\d{3})*))(\.\d{2})?$/.test(v); });
            value.date = $.spec(function(v){ return /^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/.test(v); });
            value.alpha = $.spec(function(v){ return /^[A-Za-z]+$/.test(v); });
            value.numeric = $.spec(function(v){ return /^\d+$/.test(v); });
            value.alphaNumeric = $.spec(function(v){ return /^[A-Za-z\d]+$/.test(v); });
            value.phone = $.spec(function(v){ return /^\d{10,11}|(((1\s)?\(\d{3}\)\s?)|((1\-)?\d{3}\-))\d{3}\-\d{4}$/.test(v); });
            value.ssn = $.spec(function(v){ return /^(\d{9}|(\d{3}\-\d{2}\-\d{4}))$/.test(v); });
            value.email = $.spec(function(v){ return /^\w+(\.\w+)?@\w+(\.\w+)?\.[A-Za-z0-9]{2,}$/.test(v); });
        }
        catch(e) { }
        finally { return value; }
    })()
};

function collection(name, obj) {
    if(!$.exists(name))
        throw $.ku4exception("$.collection", $.str.format("Invalid name={0}. Must be unique", name));
    this._name = name;
    this._data = $.dto(obj);
    this._store = $.ku4store();
}
collection.prototype = {
    name: function() { return this._name; },
    isEmpty: function() { return this._data.isEmpty(); },
    count: function() { return this._data.count(); },
    store: function(store) { this._store = store; return this; },
    save: function(callback) { this._store.write(this, callback); return this; },
    init: function(list) { return this.remove().insertList(list); },
    find: function(query) {
        if(!$.exists(query)) return this._data.values();

        var $in = query.$in,
            $spec = query.$spec,
            $orderby = query.$orderby,
            criteria = ($.exists(query.$criteria)) ? query.$criteria : query,
            dto = $.dto(criteria).remove("$in").remove("$spec").remove("$orderby"),
            results = ($.exists($in))
                ? collection_in(this._data, $in)
                : (dto.isEmpty())
                    ? this._data.values()
                    : collection_find(this._data, dto.toObject());

        if($.exists($spec)) results = collection_spec(results, $spec);
        return ($.exists($orderby)) ? collection_orderby(results, $orderby) : results;
    },
    insert: function(entity) {
        var ku4Id = $.uid(),
            dto = $.dto(entity),
            data = dto.toObject();
        this._data.add(ku4Id, data);
        return this;
    },
    insertList: function(list) {
        $.list(list).each(function(entity) { this.insert(entity); }, this);
        return this;
    },
    remove: function(criteria) {
        if(!$.exists(criteria)) this._data.clear();
        else this._data.each(function(obj) {
            var entity = obj.value;
            if($.dto(entity).contains(criteria)) this._data.remove(obj.key);
        }, this);
        return this;
    },
    update: function(current, updates) {
        var _updates = $.dto(updates).replicate();
        if(!$.exists(current) || !$.exists(updates)) return;
        else this._data.each(function(obj) {
            var entity = obj.value;
            if($.dto(entity).contains(current)) {
                var newValue = $.dto(entity).merge(_updates).toObject();
                this._data.update(obj.key, newValue);
            }
        }, this);
        return this;
    },
    join: function(other, onKey, equalKey) {
        var thisResults = $.list(this.find()),
            otherResults = $.list(other.find()),
            thisName = this.name(),
            otherName = other.name(),
            func = ($.isFunction(onKey)) ? onKey : function(t, o) { return t[onKey] === o[equalKey]},
            join = $.hash();

        function addRecord(thisResult, otherResult) {
            var record = $.hash();
            $.hash(thisResult).each(function(obj) { record.add(thisName + "." + obj.key, obj.value); });
            $.hash(otherResult).each(function(obj) { record.add(otherName + "." + obj.key, obj.value); });
            join.add($.uid(), record.toObject());
        }

        thisResults.each(function(thisResult) {
            otherResults.each(function(otherResult) {
                if(func(thisResult, otherResult)) {
                    addRecord(thisResult, otherResult)
                }
            });
        });
        return $.ku4collection(thisName + "." + otherName, join.toObject());
    },
    exec: function(func) {
        if(!$.isFunction(func))
            throw $.ku4exception("$.collection", $.str.format("Invalid function={0}. exec method requires a function.", name));
        return new execCollection(this, func);
    },
    __delete: function(callback) {
        this.remove()._store.remove(this, callback);
        return this;
    },
    toObject: function() { return this._data.toObject(); },
    serialize: function() {
        var name = this._name,
            data = this.toObject();

        return $.json.serialize({ "name": name, "data": data });
    }
};
$.ku4collection = function(name, obj) { return new collection(name, obj); };
$.ku4collection.deserialize = function(serialized) {
    var obj = $.json.deserialize(serialized);
    return new collection(obj.name, obj.data);
};

function collection_find(data, criteria) {
    var entities = $.list();
    data.each(function(obj) {
        var entity = obj.value;
        if($.dto(entity).contains(criteria)) entities.add(entity);
    });
    return entities.toArray();
}

function collection_in(data, criteria) {
    var key = $.obj.keys(criteria)[0],
        ins = $.list(criteria[key]),
        results = [];
   ins.each(function(value) {
        results = results.concat(collection_find(data, $.hash().add(key, value).toObject()));
    });
    return results;
}

function collection_spec(arry, spec) {
    var results = $.list(),
        _spec = ($.exists(spec.isSatisfiedBy)) ? spec : $.spec(spec);
    $.list(arry).each(function(item){
        if(_spec.isSatisfiedBy(item)) results.add(item);
    });
    return results.toArray();
}

function collection_orderby(arry, criteria) {
    var key = $.obj.keys(criteria)[0],
        val = criteria[key],
        func = function(a, b) {
            return (a[key] < b[key]) ? -val : val;
        };
    return arry.sort(func);
}

function execCollection(collection, func) {
    this._collection = collection;
    this._exec = func || function(value) { return value; };
}
execCollection.prototype = {
    name: function() { return this._collection.name(); },
    isEmpty: function() { return this._collection.isEmpty(); },
    count: function() { return this._collection.count(); },
    store: function(store) { this._collection.store(store); return this; },
    save: function(callback) { this._collection.save(callback); return this; },
    init: function(list) {
        this._collection.init(list);
        return this;
    },
    find: function(query) {
        var values = this._collection.find(query),
            results = $.list();
        $.list(values).each(function(item){
            results.add(this._exec(item));
        }, this);
        return results.toArray();
    },
    insert: function(entity) {
        this._collection.insert(entity);
        return this;
    },
    remove: function(criteria) {
        this._collection.remove(criteria);
        return this;
    },
    update: function(current, updates) {
        this._collection.update(current, updates);
        return this;
    },
    join: function(other, onKey, equalKey) {
        return new execCollection(this._collection.join(other, onKey, equalKey));
    },
    exec: function(func) {
        return this._collection.exec(func);
    },
    __delete: function(callback) {
        this._collection.__delete(callback);
        return this;
    },
    serialize: function() {
        return this._collection.serialize();
    }
};

function indexedDbStore(name) {
    this._name = name || "ku4indexedDbStore";
}
indexedDbStore.prototype = {
    read: function(collectionName, callback) {
        var name = this._name,
            me = this;

        ku4indexedDbStore_openDb(name, function (err, db) {
            db.transaction(collectionName)
                .objectStore(collectionName)
                .get(1)
                .onsuccess = function (event) {
                    var data = event.target.result,
                        collection = $.ku4collection(collectionName, data).store(me);
                    if($.exists(callback)) callback(null, collection);
                    db.close();
                };
        }, collectionName);
        return this;
    },
    write: function(collection, callback) {
        var collectionName = collection.name(),
            name = this._name,
            me = this;

        ku4indexedDbStore_openDb(name, function (err, db) {
            if($.exists(err)) {
                if($.exists(callback)) callback(err, null);
            }
            else {
                var request = db.transaction([collectionName], "readwrite").objectStore(collectionName).put(collection.toObject(), 1);
                request.onerror = function () {
                    if($.exists(callback)) callback(new Error("Error writing data to indexedDbStore"), me);
                    db.close();
                };
                request.onsuccess = function () {
                    if($.exists(callback)) callback(null, me);
                    db.close();
                };
            }
        }, collectionName);
        return this;
    },
    remove: function(collection, callback) {
        var collectionName = collection.name(),
            name = this._name,
            me = this;

        ku4indexedDbStore_openDb(name, function (err, db) {
            if($.exists(err)) callback(err, null);
            else {
                var request = db.transaction([collectionName], "readwrite").objectStore(collectionName)["delete"](1);
                request.onerror = function () {
                    if($.exists(callback)) callback(new Error("Error removing data to indexedDbStore"), me);
                    db.close();
                };
                request.onsuccess = function () {
                    if($.exists(callback)) callback(null, me);
                    db.close();
                };
            }
        }, collectionName);
        return this;
    },
    __delete: function(callback) {
        var idxdb = indexedDB || webkitIndexedDB || mozIndexedDB,
            request = idxdb.deleteDatabase(this._name),
            me = this;

        request.onerror = function() { if($.exists(callback)) callback(new Error("Error deleting indexedDbStore.", me))};
        request.onsuccess = function() { if($.exists(callback)) callback(null, me); };
        return this;
    }
};

$.ku4indexedDbStore = function(name) { return new indexedDbStore(name); };

var __ku4indexedDbStoreVersion;
function ku4indexedDbStore_openDb(name, callback, collectionName) {
    var idxdb = indexedDB || webkitIndexedDB || mozIndexedDB;
        request = (!__ku4indexedDbStoreVersion)
                    ? idxdb.open(name)
                    : idxdb.open(name, __ku4indexedDbStoreVersion);

    console.log("version == ", __ku4indexedDbStoreVersion)

    request.error = function(){
        callback(new Error("Error opening Indexed Database."), null);
    };

    request.onupgradeneeded = function (event) {
        var db = event.target.result,
            objectStore = db.createObjectStore(collectionName, { autoIncrement: false });
    };

    request.onsuccess = function () {
        var db = request.result;
        __ku4indexedDbStoreVersion = db.version;
        try {
            db.transaction(collectionName);
            callback(null, db);
        }
        catch(e)
        {
            console.log(e);
            __ku4indexedDbStoreVersion++;
            ku4indexedDbStore_openDb(name, callback, collectionName);
        }

    };
}

function localStorageStore() { }
localStorageStore.prototype = {
    read: function(collectionName, callback) {
        var collection = localStorage.getItem(collectionName),
            ku4collection =  ($.exists(collection))
                ? $.ku4collection.deserialize(collection).store(this)
                : $.ku4collection(collectionName).store(this);

        if($.exists(callback)) callback(null, ku4collection);
        return ku4collection;
    },
    write: function(collection, callback) {
        localStorage.setItem(collection.name(), collection.serialize());
        if($.exists(callback)) callback(null, this);
        return this;
    },
    remove: function(collection, callback) {
        localStorage.removeItem(collection.name());
        if($.exists(callback)) callback(null, this);
        return this;
    },
    __delete: function(callback) {
        localStorage.clear();
        if($.exists(callback)) callback(null, this);
        return this;
    }
};
$.ku4localStorageStore = function() { return new localStorageStore(); };


var __ku4MemoryStore = $.dto();
function memoryStore() { }
memoryStore.prototype = {
    read: function(collectionName, callback) {
        var collection = __ku4MemoryStore.find(collectionName),
            ku4collection =  ($.exists(collection))
                ? $.ku4collection.deserialize(collection).store(this)
                : $.ku4collection(collectionName).store(this);

        if($.exists(callback)) callback(null, ku4collection);
        return ku4collection;
    },
    write: function(collection, callback) {
        __ku4MemoryStore.update(collection.name(), collection.serialize());
        if($.exists(callback)) callback(null, this);
        return this;
    },
    remove: function(collection, callback) {
        __ku4MemoryStore.remove(collection.name());
        if($.exists(callback)) callback(null, this);
        return this;
    },
    __delete: function(callback) {
        __ku4MemoryStore.clear();
        if($.exists(callback)) callback(null, this);
        return this;
    }
};

$.ku4memoryStore = function() { return new memoryStore(); };


$.ku4store = function() {
    var idxdb = indexedDB || webkitIndexedDB || mozIndexedDB;
    if($.exists(idxdb)) return $.ku4indexedDbStore();
    if($.exists(localStorage)) return $.ku4localStorageStore();
    else return new $.ku4memoryStore();
};

})();
