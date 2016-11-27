# NIM (Node Inspection Monitor) streamlines your Node.js development cycle when using Chrome DevTools Inspector.  NIM manages the Chrome DevTools window/tab lifecycle leaving you with more ability to focus on what matters... debugging your code.

You no longer need to copy/paste DevTools URL's or continue opening/closeing tabs/windows.

NIM automatically detects the URL that is generated when running node (locally or remotely) with --inspect option. NIM provides you with the option of automatically opening and closing Chrome DevTools in a tab or window. Just toggle the Manual/Auto setting and then start a debugging session.  DevTools will open either on clicking the "Open DevTools" button or after the specified timeout period.  If set to auto close, once you end your debugging session, DevTools will close automatically.
 * Manage and monitor local and remote debugging sessions
 * Manual or automatic control of DevTools interface
 * Open DevTools in a new tab or window
 * Make DevTools focused or inactive on start
 * Customize duration between v8 Inspector probes
 * Autosave settings

*Note: At the time of writing, the v8 --inspect option is fairly new. See https://nodejs.org/api/debugger.html#debugger_v8_inspector_integration_for_node_js for additional details on the option.*
### If you enjoy using NIM please give us a 5 star rating and/or a G+1.  Any and all feedback is encouraged and welcome.  [Send us an email!](mailto:667@june07.com)

# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) 
and this project adheres to [Semantic Versioning](http://semver.org/).

### [Unreleased]
### [0.6.0] - 2016-11-26
#### Added
- UI improvements
### [0.4.0] - 2016-11-17
#### Added
- Added the option of auto closing the Chrome DevTools session (tab or window).
