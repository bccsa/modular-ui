// =====================================
// modular-ui base classes
//
// Copyright BCC South Africa
// =====================================

// Map of element types, attributes and matching events supported for automatic data binding.
// For attributes that can be changed from the web-page, the event name is included.
// For attributes that only should be set in JavaScript (i.e removed from the element HTML), jsOnly is set to true.
// If a element type cannot be found or an attribute is not listed under the specified element type, modular-ui will try to find the attribute in _default.
const __bindingMap = {
  _default: {
    textContent: { },
    title: { },
    hidden: { jsOnly: true },
    disabled: { jsOnly: true },
  },
  a: {
    href: { },
  },
  input: {
    value: { event: 'change' },
    checked: { event: 'change', jsOnly: true },
    max: { },
    min: { },
    step: { },
    placeholder: { },
  },
  textarea: {
    value: { event: 'change', jsOnly: true },
  },
  select: {
    value: { event: 'change' },
  },
  img: {
    src: { },
  },
  progress: {
    max: { },
    value: { },
  },
  video: {
    src: { },
  },
}

// Map of element types and attributes to be ignored
const __ignoreMap = {
  elements: {

  },
  attributes: {
    for: true,
  },
}

/* #region  Dispatcher Event */
// Code adapted from https://labs.k.io/creating-a-simple-custom-event-system-in-javascript/
class DispatcherEvent {
  constructor(eventName) {
    this.eventName = eventName;
    this.callbacks = [];
  }

  registerCallback(callback, once) {
    this.callbacks.push({ callback: callback, once: once });
  }

  unregisterCallback(callback) {
    const index = this.callbacks.findIndex(c => Object.is(c.callback, callback));
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  unregisterAll() {
    this.callbacks.splice(0, this.callbacks.length);
  }

  fire(data) {
    const callbacks = this.callbacks.slice(0);
    var once = [];
    callbacks.forEach((c) => {
      c.callback(data);
      if (c.once) {
        once.push(c);
      }
    });

    // Unregister callbacks for all "one" events
    once.forEach((c) => {
      this.unregisterCallback(c.callback);
    });
  }
}

// code adapted from https://labs.k.io/creating-a-simple-custom-event-system-in-javascript/
class Dispatcher {
  constructor() {
    this.events = {};
  }

  /**
   * Emit an event
   * @param {string} eventName 
   * @param {*} data 
   */
  emit(eventName, data) {
    const event = this.events[eventName];
    if (event) {
      event.fire(data);
    }
  }

  /**
   * Subscribe to event
   * @param {string} eventName 
   * @param {*} callback 
   */
  on(eventName, callback) {
    let event = this.events[eventName];
    if (!event) {
      event = new DispatcherEvent(eventName);
      this.events[eventName] = event;
    }
    event.registerCallback(callback);
  }

  /**
   * Subscribe to the event only for one fire
   * @param {string} eventName 
   * @param {*} callback 
   */
  one(eventName, callback) {
    let event = this.events[eventName];
    if (!event) {
      event = new DispatcherEvent(eventName);
      this.events[eventName] = event;
    }
    event.registerCallback(callback, true);
  }

  /**
   * Unsubscribe from event
   * @param {string} eventName 
   * @param {*} callback 
   */
  off(eventName, callback) {
    const event = this.events[eventName];
    if (event && event.callbacks.indexOf(callback) > -1) {
      event.unregisterCallback(callback);
      if (event.callbacks.length === 0) {
        delete this.events[eventName];
      }
    }
  }

  /**
   * Unsubscribe from all events.
   */
  clearEvents() {
    Object.values(this.events).forEach(e => {
      e.unregisterAll();
    });
  }
}
/* #endregion */

/* #region  modular-ui base class */
/**
 * modular-ui base class
 */
class ui extends Dispatcher {
  /**
   * modular-ui base class
   */
  constructor() {
    super();
    this.name = "controlName"; // Special property indicating the name of the control. This cannot be changed in runtime.
    this._path = ""; // Special property containing the path to the modular-ui controls classees.
    this.controlType = this.constructor.name; // The name of the class. This property should not be set in code.
    this._parent = undefined; // Reference to the parent control (if any)
    this._topLevelParent = undefined; // Reference to the top level parent. Undefined if this control is the top level parent.
    this._element = document.createElement('div'); // Control's top level element. All custom html is added inside this element (see get html())
    this._controls = {}; // List of child controls
    this._properties = {}; // List of properties populated for properties with getters and setters
    this._controlsQueue = []; // Queue child controls to be created
    this._initQueue = []; // Queue child controls to be initialized while this control is not yet initialized
    this._styles = []; // Add css style paths to this array
    this._appliedStyles = []; // List of applied CSS style sheets
    this._pendingScripts = {}; // List of controls waiting for the loaded script to be applied
    this._htmlQueue = {}; // List of controls waiting to be be added to the DOM.
    this._uuid = this._generateUuid(); // Unique ID for this control
    this._controlsDiv = undefined; // Add a DOM reference to the _controlsDiv property if the control must support child controls
    this._init = false; // True when the control has been initialized (DOM linkup complete)
    this._updateList = []; // List of properties that needs to be updated
    this._elementIdQueue = []; // List of element object names (to be added as class properties) and element ID's
    this._elementAttributeQueue = []; // List of element attributes to be bound to class properties
    this.parentElement = ''; // Used to specify in which HTML element in the parent the child should be added
    this.hideData = false; // Set to true if the control's data should be excluded from GetData() and from _notify();
    this.remove = undefined; // When control.remove : true is passed to the control via SetData(), the control is removed by it's parent.
    this.display = 'inherit'; // Default display style for the control's containing element.
    this.visible = true; // Visibility of the control. If set through SetData() it sets the visibility according to the visibility parameter passed. It can also be controlled via the SHow() and Hide() methods.
    this._element.id = this._uuid;
  }

  // -------------------------------------
  // Overridden functions
  // -------------------------------------
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

  // -------------------------------------
  // Override Getters & setters
  // -------------------------------------

  /**
   * Override this getter in the implementing class
   */
  get html() {
    return `
      <div id="${this._uuid}_main"  >
        <!-- ${this.name} -->
        <div id="${this._uuid}_controls"></div>
      </div>`;
  }

  // -------------------------------------
  // Override Functions
  // -------------------------------------

  /**
   * Implementing class should override this function
   * This function is called by the parent control when the child's (this control) html has been printed to the DOM.
   */
  Init() {
    this._mainDiv = document.getElementById(`${this._uuid}_main`);

    // Element containing child controls. Controls that should not be able to host child controls
    // should not include this line.
    this._controlsDiv = document.getElementById(`${this._uuid}_controls`);
  }

  /**
   * Remove the control from the DOM
   */
  RemoveHtml() {
    this._element.remove();
  }

  /**
   * Depreciated. Use the property changed event instead: control.on('<propertyName>'), (val) => {})
   * Implementing class should override this function.
   * This function is called when data has been received through the SetData method.
   * @param {*} propertyName - string property name to be updated to the DOM from the (previously set) control's property.
   */
  Update(propertyName) { }

  // -------------------------------------
  // Core functions
  // -------------------------------------

  /**
   * Gets a list of child controls
   */
  get childControls() {
    return this._controls;
  }

  /**
   * Sets a javascript data object, and updates values, creates and removes controls as applicable.
   * @param {*} data 
   */
  SetData(data) {
    if (data && typeof data == 'object') {
      Object.keys(data).forEach((k) => {
        // Check for remove command
        if (k == "remove") {
          if (data[k] == true) {
            this._parent.RemoveChild(this.name);
          }
        }
        // Ignore invalid and special keys
        else if (k[0] != "_" && k != "controlType") {
          // Update this control's settable (not starting with "_") properties
          if (
            this[k] != undefined &&
            (typeof this[k] == "number" ||
              typeof this[k] == "string" ||
              typeof this[k] == "boolean" ||
              Array.isArray(this[k]))) {
            if (data[k] != null && data[k] != undefined) {
              this[k] = data[k];
            }
            else {
              // Prevent properties to be set to undefined or null
              this[k] = `${data[k]}`;
            }

            // Notify to update the DOM if control has been initialized
            if (this._init) {
              this._updateList.push(k);
            }
          }
          // Update child controls. If a child control shares the name of a settable property, the child control will not receive data.
          else if (this._controls[k] != undefined) {
            this._controls[k].SetData(data[k]);
          }
          // Create a new child control if the passed data has controlType set. If this control is not ready yet (Init did not run yet),
          // add new child controls to a controls queue.
          else if (data[k] != null && data[k].controlType != undefined) {
            this._createControl(data[k], k);
          }
        }
      });

      // Update the DOM
      this._updateList.forEach((k) => {
        this.Update(k);
      });
    }
  }

  /**
   * Create a new control from data
   * @param {object} data - Control data structure. (May include child controls.)
   * @param {string} name - Control name
   */
  async _createControl(data, name) {
    // Pre-load script
    this.LoadScript(data.controlType).catch(err => {
      console.log(err);
    });

    // Add to queue
    this._controlsQueue.push({ data: data, name: name });

    // Only start processing with first control. Subsequent controls will be processed from the queue
    if (this._controlsQueue.length == 1) {
      // Process queue
      while (this._controlsQueue.length > 0) {
        let c = this._controlsQueue[0];

        // Check if control already exists. This is needed to prevent creation of duplicate controls if SetData() is executed more than once for the same control, resulting in more than one control in the _controlsQueue.
        if (this._controls[c.name]) {

          // Set control child data
          this._controls[c.name].SetData(c.data);
        } else {

          // Child control does not exist: continue to create control.
          let controlClass = this._getDynamicClass(c.data.controlType);

          // Load script if class does not exists
          if (!controlClass) {
            await this.LoadScript(c.data.controlType).then(result => {
              if (result) {
                controlClass = this._getDynamicClass(c.data.controlType);
              }
            }).catch(err => {
              console.log(err);
            });
          }

          // Check that the class is loaded
          if (controlClass) {
            // Create new control
            let control = new controlClass();
            control.name = c.name;
            control._parent = this;
            control._path = this._path;

            // Set reference to top level parent
            if (this._topLevelParent) {
              control._topLevelParent = this._topLevelParent;
            } else {
              control._topLevelParent = this;
            }

            // Apply css style sheets
            control._styles.forEach(async s => {
              await this.ApplyStyle(s);

              // To do: test if styles are loaded before continuing.
            });

            // Create getters and setters
            Object.getOwnPropertyNames(control).forEach((k) => {
              // Only return settable (not starting with "_") properties
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
                    // Only emit property changes
                    if (this._properties[k] != val) {
                      this._properties[k] = val;
                      this.emit(k, val);
                    }
                  }
                });
              }
            });

            // Add new control to controls list
            this._controls[c.name] = control;

            // Add a direct reference to the control in this control
            this[c.name] = control;

            this.emit('newChildControl', control);

            // Set control child data
            control.SetData(c.data);

            // Determine destination element
            let e = "_controlsDiv"; // default div
            if (c.data.parentElement && typeof c.data.parentElement === 'string') {
              e = c.data.parentElement;
            }

            // Initialize child controls, or add to initialization queue if this control is not initialized yet
            if (!this._init) {
              this._initQueue.push({ control: control, element: e });
            } else {
              this._initControl(control, e);
            }
          }
        }

        // Remove control from queue
        this._controlsQueue.shift();
      }
    }
  }

  /**
   * Initialize a child control and print it in the passed element name
   * @param {object} control - Control to be initialized
   * @param {string} element - Element name (string)
   */
  _initControl(control, element) {
    if (control != undefined && control.name != undefined) {
      // Set control visibility
      if (control.visible) {
        control.Show();
      }
      else {
        control.Hide();
      }

      // Create queue for the passed element
      if (this._htmlQueue[element] == undefined) {
        this._htmlQueue[element] = [];
      }

      if (this._htmlQueue[element].length > 0) {
        // another control is already being initialized. Add to queue
        this._htmlQueue[element].push(control);
      }
      else {
        // This is the first control to be added to the DOM.
        // Add to init queue
        this._htmlQueue[element].push(control);

        this._addHtml(element)
      }
    }
    else {
      console.log(`Unable to add control to element "${element}"`)
    }
  }

  /**
   * Adds HTML to the giving element from the initMutationCache
   * @param {string} element - Element object name
   */
  _addHtml(element) {
    try {
      let control = this._htmlQueue[element][0];

      // Wait for HTML to be printed in the element, and call Init
      let parentControl = this;
      const observer = new MutationObserver(function (mutationsList, observer) {

        observer.disconnect();
        control._createDataBindings();
        control.Init();
        control._init = true;

        // Notify that initialization is done
        control.emit("init", control);

        parentControl._notifyControlCreated(control.name, control);

        // ################## test logic #######################
        // console.log(`Control ${control.name} added to the DOM`);

        // Remove control from the queue
        parentControl._htmlQueue[element].shift();

        // Add html of subsequent controls in the queue
        if (parentControl._htmlQueue[element] != undefined && parentControl._htmlQueue[element].length > 0) {
          parentControl._addHtml(element);
        }

        // Add queued child controls
        while (control._initQueue.length > 0) {
          let c = control._initQueue.shift();
          control._initControl(c.control, c.element);
        }
      });

      // Observe controls element for changes to contents
      observer.observe(parentControl[element], { childList: true, attributes: false });

      let p = this._parseHtml(control);

      // Add element ids for data binding
      control._elementIdQueue.push(...p.idData);

      // Add element attributes for data binding
      control._elementAttributeQueue.push(...p.elementData);

      // Print HTML of child control into it's own top level element
      control._element.innerHTML = p.html;

      // Add the child control's top level element to the parent's controls div
      parentControl[element].appendChild(control._element);
    }
    catch (error) {
      console.log(`Unable to add HTML to element "${element}" in control "${parent.name}". ${error.message}`);
    }
  }

  /**
   * Checks if the passed object is an array.
   * @returns Array with passed array elements. If passed element is not an array, passes an array with one element.
   */
  __array(data) {
    if (data != null && data != undefined) {
      if (Array.isArray(data)) {
        return data;
      } else {
        let a = [];
        a.push(data);
        return a;
      }
    } else {
      return [];
    }
  }

  /**
   * Parse html of a control, and creates properties for parsed elements identified with @{identifier} tags.
   * Currently only html element id's are supported.
   * @param {string} html 
   * @returns {Object} - Object with modified html (identifier tags replaced with unique ID's) and data binding data.
   */
  _parseHtml(control) {
    var html = control.html;
    let eDataList = []; // element data list
    let idList = {};    // id list

    // Extract HTML elements with class properties inserted with @{identifier} tags
    let eList = this.__array(html.match(/<[^<]*>[ |\t|\n]*@{[_a-zA-Z0-9]*}[ |\t|\n]*<\/[^<]*>|<[^<]*@{[_a-zA-Z0-9]*}[^<]*(>[^>]*<\/[^<]*>|[\/]?>)/gmi));
    eList.forEach(elementHtml => {
      var elementHtml_new = elementHtml;

      // Extract the element type
      let eType = this.__array(elementHtml.match(/^<[a-zA-Z]*[0-9]?/gmi));
      if (eType.length > 0) {
        eType = eType[0].replace('<', '').toLowerCase();
      } else {
        console.log(`${control.name}: Unable to parse element: Element type not set.`);
        return;
      }

      // Ignore elements in ignore map
      if (__ignoreMap.elements[eType]) return;

      // Element data
      let eData = { elementType: eType, attributes: {} };

      let tagList = [];

      // Extract all instances of @{identifier} tags
      this.__array(elementHtml.match(/[a-zA-Z]*\=["|']?@{[_a-zA-Z0-9]*}|>[ |\t|\n]*@{[_a-zA-Z0-9]*}[ |\t|\n]*</gmi)).forEach(tData => {
        // Get attribute type
        let aType = this.__array(tData.match(/[a-zA-Z]+=/gmi));
        if (aType.length > 0) {
          aType = aType[0].replace('=', '');
        } else {
          aType = 'textContent';
        }

        // Ignore attributes in ignore map
        if (__ignoreMap.attributes[aType]) return;

        // Get the indentifier tag
        let tag = this.__array(tData.match(/@{[_a-zA-Z0-9]*}/gmi))[0].replace('@{', '').replace('}', '');
        tagList.push(tag);

        // Add attribute
        if (!eData.attributes[aType]) {
          eData.attributes[aType] = tag;
        } else {
          console.log(`${control.name}: Unable to link property "${tag}" to element "${eType}" attribute "${aType}": duplicate attribute`);
        }
      });

      if (!eData.attributes.id) {
        // Check element for existing (invalid) ID
        if (elementHtml.match(/[ |\t]+id=/gmi)) {
          console.log(`${control.name}: Unable to link properties to element "${eType}": Invalid element ID - ID not an @{identifier} tag)`);
          return;
        } else {
          // Create element ID if element does not have an ID specified
          // Use the same name for the element object reference (to be created) and the element id
          let id = `${control._uuid}_id_${this._generateUuid()}`;
          eData.attributes.id = id;
          idList[id] = id;

          elementHtml_new = elementHtml_new.replace(/^<[a-zA-Z]*/gmi, `<${eType} id="${id}"`);    
        }
      } else if (!idList[eData.attributes.id]) {
        idList[eData.attributes.id] = `${eData.attributes.id}_${control._uuid}`;
      }

      // Remove JavaScript only attributes from HTML
      Object.keys(eData.attributes).forEach(attribute => {
        if (__bindingMap[eType] && __bindingMap[eType][attribute] && __bindingMap[eType][attribute].jsOnly) {
          // Update element html
          let r = new RegExp(`${attribute}=[ |\t]*["|']?@\{${eData.attributes[attribute]}\}["|']?`, 'gmi');
          elementHtml_new = elementHtml_new.replace(r, '');
        }
      });

      // Update element with tag values
      //      filter unique values tags assigned to the element ID
      tagList.filter((v, i, a) => a.indexOf(v) === i).filter(t => t != eData.attributes.id).forEach(tag => {
        // Validate tag
        if (control[tag] != undefined) {
          // Update element html
          let r = new RegExp(`@\{${tag}\}`, 'gmi');
          elementHtml_new = elementHtml_new.replace(r, control[tag]);
        }
      });

      // Update html with updated element
      html = html.replace(elementHtml, elementHtml_new);

      eDataList.push(eData);
    });

    // Replace all id @{identifier} tags with the generated element id's
    let idArr = [];
    Object.keys(idList).forEach(id => {
      let r = new RegExp(`@\{${id}\}`, 'gmi');
      html = html.replace(r, idList[id]);

      // Convert id list to array
      idArr.push({ id: id, elementID: idList[id] });
    });

    return { html: html, idData: idArr, elementData: eDataList }
  }

  /**
   * Create data bindings from @{identifier} tags
   */
  _createDataBindings() {
    // Create element references
    while (this._elementIdQueue.length > 0) {
      let i = this._elementIdQueue.shift();
      if (this[i.id] == undefined) {
        this[i.id] = document.getElementById(i.elementID);
        if (!this[i.id]) {
          console.log(`${this.name}: Unable to create element reference "${i.id}": Element not found`);
        }
      } else {
        console.log(`${this.name}: Unable to create element reference "${i.id}": Class property already exists`);
      }
    }

    // Attribute data binding
    while (this._elementAttributeQueue.length > 0) {
      let eData = this._elementAttributeQueue.shift();

      Object.keys(eData.attributes).forEach(a => {
        let prop = eData.attributes[a]; // Property name
        let elem = this[eData.attributes.id]; // Element reference

        // Subscribe to element changes for supported elements
        this._bind(eData.elementType, elem, a, prop);
      });
    }
  }

  /**
   * Bind a property value to an element attribute. Changes are also notified
   * @param {*} elementType 
   * @param {*} element 
   * @param {*} attribute 
   * @param {*} property 
   */
  _bind(elementType, element, attribute, property) {
    if (attribute != 'id' && (typeof this[property] != 'object' || Array.isArray(this[property]))) {
      let e = elementType;
      // Set element type to _default if element + attribute combination is not found in map.
      if (!__bindingMap[e] || !__bindingMap[e][attribute]) e = '_default';
      
      if (__bindingMap[e] && __bindingMap[e][attribute]) {
        // Set initial value for JavaScript only attributes
        if (__bindingMap[e][attribute].jsOnly) element[attribute] = this[property];

        this.__bind(element, attribute, __bindingMap[e][attribute].event, property);
      } else {
        console.log(`${this.name}: Unable to bind element "${elementType}" attribute "${attribute}" to property "${property}": Unsupported attribute`);
      }
    }
  }

  __bind(element, attribute, event, property) {
    // Flags to prevent double events
    let block1 = false;
    let block2 = false;

    // Subscribe to property change
    this.on(property, val => {
      if (!block1) {
        block2 = true;
        element[attribute] = val;
        block2 = false;
      }
    });

    if (event) {
      if (!element || !element.addEventListener) {
        console.log(`${this.name}: Unable to add event listner "${event}" for property "${property}": Invalid element`);
        return;
      }
      // Subscribe to element event
      element.addEventListener(event, () => {
        if (!block2) {
          // Parse value
          let v;
          switch (typeof this[property]) {
            case 'string':
              v = element[attribute].toString();
              break;
            case 'number':
              v = Number.parseFloat(element[attribute].toString());
              break;
            case 'boolean':
              v = element[attribute].toString() === 'true';
              break;
            default:
              console.log(`${this.name}: Unable to process element changes "${event}" for property "${property}": Unsupported property type (property not string, number or boolean)`);
              break;
          }

          if (v != undefined) {
            block1 = true;
            this[property] = v;
            block1 = false;

            // Notify property change
            this.NotifyProperty(property);
          } else {
            console.log(`${this.name}: Unable to process element changes "${event}" for property "${property}": Invalid value (value not string, number or boolean)`);
          }
        }

      });
    }
  }

  // // Set initial value
  // this[b.element].value = this[b.valueProperty];

  // // Flags for preventing double event firing
  // let block1 = false;
  // let block2 = false;

  // // Listen for element value change
  // let t = this;
  // this[b.element].addEventListener('change', e => {
  //   if (!block2) {
  //     block1 = true;
  //     block2 = false;
  //     // To do: parse value if needed
  //     t[b.valueProperty] = e.target.value;

  //     // Notify change
  //     t.NotifyProperty(b.valueProperty);
  //   }
  // });

  // // Listen for property changes
  // this.on(b.valueProperty, val => {
  //   if (!block1) {
  //     block2 = true;
  //     block1 = false;

  //     this[b.element].value = val;
  //   }
  // });


  /**
   * Get control data as an javascript object
   * @param {Object} options - { sparse: false/true (true [default]: Do not return empty properties; false: Return empty properties;) }
   * @returns 
   */
  GetData(options = { sparse: true }) {
    var data = {};

    // Get own properties
    Object.getOwnPropertyNames(this._properties).forEach((k) => {
      if (options.sparse && this._properties[k] != '' || !options.sparse) {
        data[k] = this._properties[k];
      }
    });

    // Get child controls properties
    Object.keys(this._controls).forEach((k) => {
      if (
        this._controls[k].GetData() != undefined &&
        !this._controls[k].hideData
      ) {
        data[k] = this._controls[k].GetData();
      }
    });

    return data;
  }

  /**
   * Remove child control
   * @param {*} control - Name of the child control
   */
  RemoveChild(control) {
    if (this._controls[control] != undefined) {
      let c = this._controls[control];
      this._controls[control].RemoveHtml();
      delete this._controls[control];
      delete this[control];

      // Emit remove event
      c.emit('remove', c);

      // Unregister from all events
      c.clearEvents();
    }
  }

  /**
   * Apply a CSS stylesheet to the DOM
   * @param {*} ref - URL or reference to the stylesheet file
   */
  ApplyStyle(ref) {
    return new Promise((resolve, reject) => {
      if (!this._appliedStyles.includes(ref)) {
        this._appliedStyles.push(ref);
        if (this._parent != undefined) {
          return this._parent.ApplyStyle(ref);
        } else {
          let l = document.styleSheets.length;
          let t = setInterval(() => {
            if (document.styleSheets.length > l) {
              resolve();
              clearInterval(t);
            }
          }, 10);

          // ref https://stackoverflow.com/questions/11833759/add-stylesheet-to-head-using-javascript-in-body
          let head = document.head;
          let link = document.createElement("link");

          link.type = "text/css";
          link.rel = "stylesheet";
          link.href = this._path + "/" + ref;

          head.appendChild(link);

          // let r = this._path + "/" + ref;
          // document.head.innerHTML += `<link rel="stylesheet" href="${r}">`;
        }
      }
      else {
        resolve();
      }
    });
  }

  /**
   * Load the javascript file for the passed data.controlType. Re-applies the passed data to the callerControl when the script has been loaded so that the callerControl can create the child control.
   * @param {string} className - name of the control class (script file name excluding extension)
   * @returns {Promise} - Returns a promise with a true / false result indicating if the script has been loaded successfully
   */
  LoadScript(className) {
    if (this._getDynamicClass(className)) {
      return new Promise((resolve, reject) => {
        // Resolve empty promise indicating that no new class was loaded
        resolve();
      });
    } else {
      if (this._parent != undefined) {
        // Pass the request to the top level parent
        return this._parent.LoadScript(className);
      }
      else {
        return new Promise(async (resolve, reject) => {
          // Subscribe to the _scriptLoad event
          this.one(`_scriptLoad_${className}`, result => {
            resolve(result);
          });

          // Only process first request
          if (!this._pendingScripts[className]) {
            this._pendingScripts[className] = true;

            try {
              // Download script file to check if script extends another class
              let scriptFile = await fetch(this._path + "/" + className + ".js");
              let text = await scriptFile.text();

              // Match class with extend keyword
              let match = text.match(/class[\t_a-zA-Z0-9 ]*extends[\t_a-zA-Z0-9 \n]*{/gm);
              if (Array.isArray(match)) {
                match = match[0];
              }

              if (match) {
                // Extract extended class name
                match = match.replace(/class[\t_a-zA-Z0-9 ]*extends[ \t\n]*/gm, '');
                match = match.replace(/[\t_ \n]*{/gm, '');
                await this.LoadScript(match);
              }

              // Load script
              const script = document.createElement('script');
              script.type = 'text/javascript';

              // Create child controls when the script is done loading
              script.onload = () => {
                // Delete the pending controls flag
                delete this._pendingScripts[className];

                // fire _scriptLoad event
                this.emit(`_scriptLoad_${className}`, true);
              }

              // Set script path including the root path passed to the top level parent element
              script.src = this._path + "/" + className + ".js";

              // Add to DOM head
              document.head.appendChild(script);
            } catch (err) {
              console.log(`Unable to load "${className}". ${err.message}`);
              delete this._pendingScripts[className];

              this.emit(`_scriptLoad_${className}`, false);

              resolve();
            }
          }
        });
      }
    }
  }

  /**
   * Notifies parent control of a change to the given property or array of properties and triggers the onChange event.
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

    this._notify(data);
  }

  /**
   * Show the control
   */
  Show() {
    this.visible = true;
    this._element.style.display = this.display;
  }

  /**
   * Hide the control
   */
  Hide() {
    this.visible = false;
    this._element.style.display = 'none';
  }

  // notifies parent of data change, and triggers onChange event.
  _notify(data) {
    if (this._parent != undefined) {
      let n = {
        [this.name]: data,
      };

      if (!this.hideData) {
        this._parent._notify(n);
      }
    }

    this.emit("data", data);
  }

  // notifies parent of the creation of a child control and fires an event with the control's name.
  _notifyControlCreated(controlName, control) {
    let n = `${this.name}.${controlName}`;
    if (this._parent != undefined) {
      this._parent._notifyControlCreated(n, control);
    }

    this.emit(controlName, control);
    this.emit('newChildControl', control);
  }

  // Generate a unique ID for this control
  _generateUuid() {
    // code from https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
    return "_" + ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    ).replace(/-/g, '');
  }

  // Return an existing class from a passed string class name
  _getDynamicClass(name) {
    // adapted from https://stackoverflow.com/questions/5646279/get-object-class-from-string-name-in-javascript

    // Create global cache
    if (!window._cls_) {
      window._cls_ = {};
    }

    if (!window._cls_[name]) {
      // cache is not ready, fill it up
      if (name.match(/^[a-zA-Z0-9_]+$/)) {
        // proceed only if the name is a single word string
        try {
          window._cls_[name] = eval(name);
        }
        catch {
          return undefined;
        }
      } else {
        // arbitrary code is detected
        // throw new Error(`Class "${name}" does not exist`);
        return undefined;
      }
    }
    return window._cls_[name];
  }
}
/* #endregion */

/* #region  uiTopLevelContainer */
class uiTopLevelContainer extends ui {
  /**
   * Top level container is added to the passed DOM element. Use the SetData() function to add child controls to the top level element.
   * @param {string} path - path to the modular-ui controls directory. If not passed, assume that the modular-ui js files are in the root folder.
   * @param {string} element - ID of the HTML DOM element where the top level container should be inserted. If not passed, the top level container is added directly to the body element.
   */
  constructor(path, element) {
    super();

    if (path != undefined) {
      this._path = path;
    }

    if (element == undefined) {
      document.body.innerHTML += this.html;
    } else {
      this.name = "modular-ui top level container"
      let e = document.getElementById(element);
      if (e) {
        e.innerHTML += this.html;
      } else {
        console.log(`Unable to find element "${element}"`);
      }
    }

    this.Init();
    this._init = true;
  }
}
/* #endregion */