Automatically loads the Chrome DevTools URL that is generated when running node with --inspect option.

This extension gives you the option of automatically opening and closing Chrome DevTools in a tab or window. Just toggle the Manual/Auto setting and then start a debugging session.  DevTools will open either on clicking the "Open DevTools" button or after the specified timeout period.  If set to auto close, once you end your debugging session, DevTools will close automatically.

At the time of writing, the v8 --inspect option is fairly new. See https://nodejs.org/api/debugger.html#debugger_v8_inspector_integration_for_node_js for additional details on the option.

0.4.0 Added the option of auto closing the Chrome DevTools session (tab or window).
