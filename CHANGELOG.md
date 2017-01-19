# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) 
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
_Added, Changed, Deprecated, Removed, Fixed, Security_

## [0.9.3] - 2017-01-19
### Fixed
- There was a "bug" where if a user was debugging remotely and did not forward the DevTools port along with the websocket port, the local websocket port would not be translated.  This was fixed.
### Changed
- Japanese localization improvements https://github.com/june07/NIM/pull/6, Thank you to ABCanG!
### Added
- Keyboard Shortcut Ctrl-I for opening DevTools.
- Hitting the Enter key for "host" or "port" input on the popup will open DevTools.
## [0.9.2] - 2016-12-30
### Changed
- Updated analytics to provide more data on program usage.
## [0.9.1] - 2016-12-27
### Changed
- Updated icon set
## [0.9.0] - 2016-12-23
### Added
- Use Local DevTools option
## [0.8.1] - 2016-12-16
### Fixed
- Language support for Portuguese and Chinese.
- Chrome tab not closing properly when using Nodemon #1
- Improve ja localization https://github.com/june07/NIM/pull/3, Thank you to onionmk2!
## [0.8.0] - 2016-12-11
### Added
- support for 10 additional languages.  Danish, Spanish, French, Italian, Japanese, Korean, Polish, Portuguese, Russian, and Chinese
## [0.7.0] - 2016-11-28
### Added
 - a very short uninstall survey.
## [0.6.1] - 2016-11-27
### Fixed
- Remote debugging only worked in some cases.
## [0.6.0] - 2016-11-26
### Added
- UI improvements
## [0.4.0] - 2016-11-17
### Added
- the option of auto closing the Chrome DevTools session (tab or window).