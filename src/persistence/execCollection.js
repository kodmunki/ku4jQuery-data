function execCollection(collection, func) {
    this._collection = collection;
    this._exec = func || function(value) { return value; };
}
execCollection.prototype = {
    name: function() { return this._collection.name(); },
    isEmpty: function() { return this._collection.isEmpty(); },
    count: function() { return this._collection.count(); },
    store: function(store) { this._collection.store(store); return this; },
    save: function() { this._collection.save(); return this; },
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
    __delete: function() {
        this._collection.__delete();
        return this;
    },
    serialize: function() {
        return this._collection.serialize();
    }
};