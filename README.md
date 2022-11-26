# modular-ui
A data-first, parent-child structured javascript front-end framework

## Known Issues
* Child components not loading on insecure (http) sites (tested on Chrome, Edge 107). This is due to the MutationObserver not observing changes to the DOM. It however works correcly when hosted locally or via https.