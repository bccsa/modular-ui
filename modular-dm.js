// =====================================
// Modular Data Model for NodeJS
//
// Copyright BCC South Africa
// =====================================

const EventEmitter = require('events');

/**
 * Base class for control modules
 * @extends EventEmitter
 */
class dm extends EventEmitter {
    constructor() {
        super();
        /**
         * Object name (used as key in key: value pairs). This should not be set in code, but is set when creating child controls through Set().
         */
        this._controlName = "";
        /**
         * List of child controls. This should not be set in code.
         */
        this._controls = {};
        /**
         * List of properties equipped with getters and setters. This should not be set / modified in code
         */
        this._properties = {};
        /**
         * Reference to the parent of this control. This should not be set in code.
         */
        this._parent = undefined;
        /**
         * Reference to the top level parent. This should not be set in code.
         */
        this._topLevelParent = undefined;
        /**
         * When true, hides the data of this control in Get() calls and automatic property change notifications.
         */
        this._hideData = false;
    }

    /**
     * Return the top level parent control
     */
    get topLevelParent() {
        if (!this._topLevelParent) {
            if (this._parent) {
                this._topLevelParent = this._parent.topLevelParent;
            } else {
                this._topLevelParent = this;
            }
        }
        return this._topLevelParent;
    }

    /**
     * Return the parent of this control
     */
    get parent() {
        return this._parent;
    }

    /**
     * Return the control type name (String)
     */
    get controlType() {
        return this.constructor.name;
    }

    /**
     * Return a list of child controls
     */
    get controls() {
        return this._controls;
    }

    /**
     * Return the control internal name (key in the object data passed to Set())
     */
    get controlName() {
        return this._controlName;
    }

    get hideData() {
        return this._hideData;
    }

    set hideData(val) {
        if (typeof val === 'boolean') {
            this._hideData = val;
        } else {
            console.log(`${this._controlName}: Invalid data set to hideData - boolean value expected.`)
        }
    }

    /**
     * Emit an event
     * @param {string} eventName 
     * @param {*} data - Data to be emitted
     * @param {string} scope - [Optional] local: Only emit on this control; bubble: Emit on this control and all parent controls; top: Only emit on top level parent control; local_top: Emit on both this control and top level parent control; (Default: local)
     */
    emit(eventName, data, scope = 'local') {
        // local emit
        if (scope == 'local' || scope == 'local_top' || scope == 'bubble') {
            super.emit(eventName, data);
        }

        // parent control emit
        if (scope == 'bubble' && this._parent) {
            this._parent.emit(eventName, data, scope);
        }

        // top level control emit
        if (scope == 'top' || scope == 'local_top') {
            this._topLevelParent.emit(eventName, data);
        }
    }

    /**
     * Get configuration as object
     * @returns {Object}
     */
    Get() {
        let data = {};

        // Get own properties
        Object.getOwnPropertyNames(this._properties).forEach((k) => {
            data[k] = this._properties[k];
        });

        // Get child controls properties
        Object.keys(this.controls).forEach((k) => {
            // Only return children with hideData unset
            if (!this.controls[k].hideData) {
                let c = this.controls[k].Get();
                if (c) data[k] = c;
            }
        });

        return data;
    }

    /**
     * Set data
     * @param {Object} data 
     */
    Set(data) {
        Object.getOwnPropertyNames(data).forEach(k => {
            // Update this control's settable (not starting with "_") properties
            if (k[0] != '_' && k != "controlType") {
                if (this[k] != undefined &&
                    (typeof this[k] == 'number' ||
                        typeof this[k] == 'string' ||
                        typeof this[k] == 'boolean')
                ) {
                    let d = this._properties[k];
                    if (data[k] != null && data[k] != undefined) {
                        // Set data to _properties to prevent property setter to be triggered.
                        this._properties[k] = data[k];
                    } else {
                        // Prevent properties to be set to undefined or null
                        this._properties[k] = `${data[k]}`;
                    }

                    // Fire property change event
                    if (d != this._properties[k]) {
                        this.emit(k, this._properties[k]);
                    }
                }

                // Update child controls. If a child control shares the name of a settable property, the child control will not receive data.
                else if (this.controls[k] != undefined) {
                    this.controls[k].Set(data[k]);
                }

                // Create a new child control if the passed data has controlType set.
                else if (data[k] != null && data[k].controlType != undefined) {
                    this._createControl(data[k], k);
                }
            }
        });
    }

    /**
     * Return an existing class from a passed string class name, or try to require the passed name (js file should have the same name)
     * @param {*} name - class name
     * @returns class
     */
    _getDynamicClass(name) {
        // adapted from https://stackoverflow.com/questions/5646279/get-object-class-from-string-name-in-javascript
        let tp = this.topLevelParent;

        // Create cache
        if (!tp._cls_) {
            tp._cls_ = {};
        }

        if (!tp._cls_[name]) {
            // cache is not ready, fill it up
            if (name.match(/^[a-zA-Z0-9_]+$/)) {
                // proceed only if the name is a single word string
                try {
                    let c = require(`./${name}`);
                    if (c) {
                        tp._cls_[name] = c;
                    }
                }
                catch {
                    return undefined;
                }
            } else {
                return undefined;
            }
        }
        return tp._cls_[name];
    }

    /**
     * Create a new control
     * @param {*} data - control data
     * @param {*} name - control name
     */
    _createControl(data, name) {
        let controlClass = this._getDynamicClass(data.controlType);

        if (controlClass) {
            // Create new control
            let control = new controlClass();
            control._controlName = name;
            control._parent = this;

            // Set control child data
            control.Set(data);

            // Add new control to controls list
            this.controls[name] = control;

            // Add a direct reference to the control in this control
            this[name] = control;

            // Create getters and setters
            Object.getOwnPropertyNames(control).forEach((k) => {
                // Only return settable (not starting with "_") properties excluding special properties
                if (
                    k[0] != "_" &&
                    (typeof control[k] == "number" ||
                        typeof control[k] == "string" ||
                        typeof control[k] == "boolean" ||
                        Array.isArray(control[k]))
                ) {
                    // Store property value in _properties list
                    control._properties[k] = control[k];

                    // Create getter and setter
                    Object.defineProperty(control, k, {
                        get: function () {
                            return this._properties[k];
                        },
                        set: function (val) {
                            if (this._properties[k] != val) {
                                // Only notify changes
                                this._properties[k] = val;
                                this.emit(k, val);
                                this.NotifyProperty(k);
                            }
                        }
                    });
                }
            });

            // Initialise control
            control.Init();

            // Emit the [controlName] event on this (newly created control's parent)
            this.emit(name, control);
        }
    }

    /**
     * Overridable method that is called directly after control creation. The [controlName] event is emitted on the control's parent directly after Init() is called. The Init() method can be overridden to add initialisation logic to extentions of the modular-dm base class.
     */
    Init() {

    }

    /**
     * Log events to an event log (exposed as 'log' event on the top level parent)
     * @param {String} message 
     */
    Log(message) {
        this.topLevelParent.emit('log', `${this.constructor._controlName} | ${this._controlName}: ${message}`);
    }

    /**
     * Wraps the propertie(s) of the passed property name(s) as key:value pairs in an object containing the path to this control, and emits the wrapped object as a 'data' event on the top level parent.
     * @param {*} propertyNames - Single string or array of string property names
     */
    NotifyProperty(propertyNames) {
        let data = {};
        if (Array.isArray(propertyNames)) {
            propertyNames.forEach((p) => {
                if (this[p] != undefined) {
                    data[p] = this[p];
                }
            });
        } else {
            if (this[propertyNames] != undefined) {
                data[propertyNames] = this[propertyNames];
            }
        }

        this.Notify(data);
    }

    /**
     * Wraps the passed data in a Javascript object containing the path to this control, and emits the wrapped object as a 'data' event on the top level parent
     * @param {Object} data 
     */
    Notify(data) {
        if (this._parent != undefined) {
            if (!this.hideData) {
                let n = {
                    [this._controlName]: data,
                };
                this._parent.Notify(n);
            }
        }
        else {
            this.emit("data", data);
        }
    }
}

// Export class
module.exports = dm;