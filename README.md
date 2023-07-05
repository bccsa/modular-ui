# modular-ui
A data-first, event driven, parent-child structured javascript front-end framework

### Structure
"User Controls" are created as JavaScript classes. (Class inheritance is supported.) Child controls are added as key / value pairs to parent controls.

### Identifier tags
Identifier tags ```@{identifier}``` can be used in the control's HTML to easily create references to elements and to link element attributes / text content to control class properties. Supported element attributes are automatically updated on class property value changes, and supported input elements will automatically update the class property value and notify the change (see (#notifying-property-changes-externally)).

When tagging elements with an ```@{identifier}``` id, a new class property is created with the javascript object reference to the element. When tagging element attributes / text content with an ```@{identifier}``` tag, modular-ui will attempt to link the element attribute's value to an existing class property named the same as the ```@{identifier}``` text.

Identifiers may only consist of the following characters: _ (underscore), a to z and A to Z.

**Important**
Take care not to use property names as element id ```@{identifier}``` tags. modular-ui creates new properties for element references, and will fail to do so if the property already exists.

**Empty attributes**
Attributes such as ```hidden``` and ```checked``` are not set with a value in html. modular-ui sees these attributes as 'JavaScript only' attributes and removes it from the html template before adding it to the DOM, but sets the value of the attribute through JavaScript after the html has been inserted into the DOM. Empty attributes should be linked to class properties the same as normal attributes adding the ```@{identifier}``` tag (e.g. ```checked=@{checkedProperty}```).

Example
```javascript
class demo extends ui {
    constructor() {
        super();

        this.coolProperty = 'Default cool value';
        this.anotherCoolProperty = 'The second cool value';
    }

    get html() {
    return `
        <span id="@{_coolElement}">@{coolProperty}</span>
        <label>@{anotherCoolProperty}</label>
        <input type="text" value="@{anotherCoolProperty}"/>`;
    }

    Init() {
        // Do some amazing things with the element
        this._coolElement.style.color = 'green';

        // Update property to automatically update the element value
        this.coolProperty = 'Another amazing value';
    }
}
```
In the above example the label text content and text input value will both be linked to the 'anotherCoolProperty' class property.

### Parent - Child structure
modular-ui makes use of a parent-child structure, where child controls are added as properties to parent controls.

Example:
```javascript
{
    Parent: {
        controlType: "someControl",
        property1: "value1",
        property2: "value2",
        child1: {
            controlType: "someOtherControl",
            childProperty1: "some value",
            childProperty2: "some value"
        },
        child2: {
            controlType: "evenAnotherControl",
            childProperty1: "some value",
            childProperty2: "some value",
            grandChild1: {
                controlType: "someControl",
                grandChildProperty1: "val"
            }
        }
    }
}
```

Including child controls' HTML output in the DOM can be done in one of two ways:
#### 1) Add a div to the parent control and set it to the _controlsDiv property
```javascript
get html() {
    return `
        <span>Simple control containing child controls</span>
        <div id="@{_controlsDiv}"</div>`
}
```
#### 2) Add a div to the parent control with a custom javascript reference, and include the property name in Set().
This method is useful when child controls need to be placed in more than one div in the parent control.

Parent control:
```javascript
get html() {
    return `
        <span>Simple control containing child controls</span>
        <div id="@{_preferredPropertyName}"></div>`
}
```
Creating the child through Set():
```javascript
parent.Set({
    child1: {
        controlType: "childControl",
        parentElement: "_preferredPropertyName"
    }
});
```

### Notifying property changes
On control creation through Set(), properties not starting with "_" of boolean, string, number or array types are automatically equipped with getters and setters. The setters fires an event with the property name and updated value when the property value is set.
The property values are stored in the control._properties object.

Set also triggers the Update(propertyName) override function when a property is set. This is however depreciated, and the events generated by the setters should be used instead to handle property value changes.

```javascript
this.on('propertyName', val => {
    // implementing logic to handle value change
})
```
Note: property change events are emitted locally only (see Events - scope = local).

### Notifying property changes externally
When calling ```this.NotifyProperty('property_name')```, modular-ui will fire a 'data' event from the top level control containing the full path to the property.

*Note*
When using ```@{identifier}``` tags in user editable HTML element attributes, modular-ui will automatically call 'NotifyProperty' for the associated class property when the element attribute value is changed by the user.

Example
```javascript
// This is the top level control created in the main JavaScript file
control.on('data', data => {
    console.log(data);
});
```
console output:
```javascript
{
    grandParent: {
        parent: {
            child: {
                coolProperty: 'new cool value'
            }
        }
    }
}
```
### Events
moduler-ui implements a configurable event emitter.

#### emit
Emitting a basic (local) event:
```javascript
control.emit('eventName', 'some event data');
```

The scope can be passed to the event emitter as the third parameter:
* local (default): Only fire the event on the local control (where it has be emitted).
* bubble: Fire the event on the local control, and all its ancestors.
* top: Only fire the event on the top level parent control.
* local_top: Fire the event on the local control as well as on the top level parent control.

Including the scope:
```javascript
control.emit('eventName', 'some event data', 'bubble');
```

#### on
Subscribing to events:
```javascript
control.on('eventName', data =< {
    // callback logic
});
```

##### options
Options can optionally be passed as a JavaScript object
* immediate: true - (only for class property change events) Calls the 'listener' callback function immediately on subscription with the current value of the property (if existing); 
* caller: [caller control] - Subscribes to the 'remove' event of the caller, and automatically unsubscribes from the event when the caller is removed. This helps to prevent uncleared references to the removed control's callback functions.

```javascript
control.on('eventName', data =< {
    // callback logic
}, { immediate: true, caller: this });
```

#### once
Subscribing to events for only one time. (After the event has fired, automatically unsubscribe.)
```javascript
control.once('eventName', data =< {
    // callback logic
});
```

##### options
Options can optionally be passed as a JavaScript object
* caller: [caller control] - Subscribes to the 'remove' event of the caller, and automatically unsubscribes from the event when the caller is removed. This helps to prevent uncleared references to the removed control's callback functions.

```javascript
control.once('eventName', data =< {
    // callback logic
}, { caller: this });
```

### Sorting
Visual sorting of child controls can be done by setting the parent control's ```parent.orderBy``` property to the name of the child controls property by who's values the child controls should be sorted. The sort order can be changed from ascending to decending by setting ```parent.orderAsc``` to false. Ordering applied to existing child controls, and also applied when new child controls are added to the parent control.

Example: The child controls have a property named 'displayOrder'.
```javascript
// Order child controls descending by displayOrder
parent.orderAsc = false;
parent.orderBy = 'displayOrder';
```

### Filtering
Visual filtering of child controls can be done through the parent control's ```parent.filter()``` method. To apply a filter, pass a predicate function to the ```parent.filter()``` function. To clear the filter, call ```parent.filter()``` without any parameters. Visual filtering does not remove controls, but hides or shows the child control HTML elements. Filtering is applied to existing child controls, and also applied when new child controls are added to the parent control.

Filtering does currently not filter live on child controls property changes (e.g. if child.age would change in the example below, the filter will not be applied).

Example: The child controls have a property named 'age'.
```javascript
// Filter to only show child controls with age > 10
parent.filter(child => child.age > 10);

// Clear the filter
parent.filter();
```

To order the child controls
## Built-in events
### remove
Emitted from a control after removal. The data returned is the control object

### newChildControl
Emitted from a parent after a child control has been added, but before Set() is called on the child control.The data returned is the added control object.

### init
Emitted after a control is initialized.

## Built-in functions
### Show
Change the display to show the control.

### Hide
Change the display to hide the control.

## Built-in properties
### display

## To do
[ ] Set() Performance improvement: Cache object paths on first call.
[ ] Document built-in events
