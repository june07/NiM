# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) 
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
_Added, Changed, Deprecated, Removed, Fixed, Security_
## [2.2.0] - 2019-05-25
### Added
- Added setting to have inspector window maximized.  https://github.com/june07/NiM/issues/70

## [2.1.1] - 2019-05-23
### Added
- Added devToolsCompat setting and made default as most recent version of Chrome seems to have the missing file browser again.

## [2.1.0] - 2019-05-13
### Added
- Added VSCode Integration https://marketplace.visualstudio.com/items?itemName=June07.nims
### Updated
- Updated deps
### Removed
- Removed Google Plus support as it's deprecated.  https://developers.google.com/+/api-shutdown

## [2.0.2] - 2019-03-28
### Fixed
- Attempt to fix https://github.com/june07/NiM/pull/69.  Will need to wait before coming to a solid conclusion as the problem is very sporadic in nature and not always reproducible.

## [2.0.1] - 2019-03-11
### Fixed
- Runaway tabs when port fowarding

## [2.0.0] - 2019-01-16
### Added
-Tabs!  Multiple simultaneous debug sessions are now possible with tabs.
-Tab notification to make identifying the active debugging tab easier

## [1.4.0] - 2019-01-14
### Added
- Added encryption
### Updated
- Improved locking code
## [1.3.2] - 2019-01-14
### Added
- Added option to have 'panel' style window.  Thank you @T99Rots for the initial PR https://github.com/june07/NiM/pull/64
## [1.3.1] - 2018-12-30
### Removed
- Removed emails from analytics.
## [1.3.0] - 2018-10-22
### Added
- Added 8 more langulage translations for Bengali, Bulgarian, Hindi, Macedonian, Malay, Persian, Swahil, and Tamil.  Thank you @aaliyahw for https://github.com/june07/NiM/pull/58, https://github.com/june07/NiM/pull/59, https://github.com/june07/NiM/pull/61, and https://github.com/june07/NiM/pull/62
## [1.2.1] - 2018-10-18
### Fixed
- Fixed a bug causing locks to pile up.
## [1.2.0] - 2018-10-14
### Updated
- Updated appspot DevTools version to Chrome 71.
### Added
- Added june07 hosted DevTools version.  Added blog post to describe the custom DevTools option https://june07.com/blog/nim-custom-devtools-url.
## [1.1.0] - 2018-10-08
### Updated
- i18N updates to 31 languages.
## [1.0.0] - 2018-10-04
### Added
- Feature to select which version of DevTools to use including a custom version.  This feature stemmed from the following Chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=851853, and will also work as a fix.
- DevTools panel for future NiM capabilities.
### Updated
- UI Improvements including moving options from a popup to a page.
## [0.15.1] - 2018-06-07
### Updated
- Added update_url per https://productforums.google.com/forum/?hl=en#!topic/chrome/kGgLwnrDKpQ;context-place=forum/chrome in hopes to fix https://github.com/june07/NiM/issues/34
## [0.15.0] - 2018-04-26
### Updated
- Polish languge updates.  Thank you @kubeek https://github.com/june07/NiM/pull/44
### Fixed
- Breaking change in Chrome Version 66.0.3359.117 (Official Build) (64-bit) see https://github.com/june07/NiM/issues/47 and https://github.com/june07/NiM/issues/46 for more info.
## [0.14.5] - 2017-11-28
### Updated
- Changed default setting back to "auto" .
### Added
- Added install page for  timely messages (i.e.  a possible solution to that nasty crashing bug), etc.
## [0.14.4] - 2017-11-16
Updated
- Changed default settings to "manual" to see if that somehow helps the crashing bug.
## [0.14.3] - 2017-11-06
### Updated
- Lots of deps.
### Changed
- Changed default key bindings for open devtools shortcut.
## [0.14.2] - 2017-10-26
### Fixed
- Forgot to update locales during GitHub Issue #32fix  push.
## [0.14.1] - 2017-10-23
### Changed
- Renamed "Hostname" label on popup to "Host" to more accurately represent the data field.  Also added/changed the regexp to match and validate data.
## [0.14.0] - 2017-10-16
### Added
- Notification upon using the keyboard shortcut.  The extra permission requirement is so that noticiations can be displayed.
### Fixed
- Bug where the auto/manual setting would revert upon enable/disable of the extension.
## [0.13.12] - 2017-10-08
### Fixed
- Regression error from yesterdays push.  Regex should not have started and ended from beginnnig and ending of line respectively.
## [0.13.9] - 2017-10-07
### Changed
- Improve Indonesian localization https://github.com/june07/Node.js-inspector-Manager-NiM-/pull/25,  and improved remote debugging host https://github.com/june07/Node.js-inspector-Manager-NiM-/pull/26.  Thank you to fatkhanfauzi for both PRs!
- Improve Russian localization https://github.com/june07/Node.js-inspector-Manager-NiM-/pull/22, Thank you to artofvs!
## [0.13.8] - 2017-05-23
### Fixed
- "Make Window Focused" option not working.  Error was due to what I believe is a bug in the Chrome code base...?  Anyhow this works around the dependancy.
## [0.13.7] - 2017-05-22
### Fixed
- Reload loop in some cases.
## [0.13.6] - 2017-05-21
### Fixed
- Stuck in a locked state in some cases.
## [0.13.5] - 2017-05-08
### Fixed
- Pretty major bug related to locking fixed.
## [0.13.4] - 2017-04-22
### Fixed
- Minor fixed to logging.
## [0.13.3] - 2017-04-17
### Added
- Faster polling (GitHub - Allow users to pick faster polling rate #13)
- Better debugging options for NiM itself using DevTools instead of the popup window.  See https://june07.com/nim/debug for details.
### Fixed
- Bug where settings were not being saved upon restart of Chrome.
## [0.12.5] - 2017-03-10
### Fixed
- Not a bug per se but I've received a lot of feedback about it so I added some alerting under certain situations.  One being when the user is trying to connect to a non-existant DevTools instance, and/or one on the wrong host, port, etc.
## [0.12.4] - 2017-03-06
### Fixed
- GitHub Issue #12 breaking change caused by 0.12.2.
## [0.12.2] - 2017-03-05
### Fixed
- GitHub Issue #11 opened by wesbos.
## [0.12.1] - 2017-02-28
### Fixed
- Improve German localization https://github.com/june07/NiM/pull/9, Thank you to hpohlmeyer!
- Improve Chinese localization https://github.com/june07/NiM/pull/10, Thank you to jingsam!
## [0.12.0] - 2017-02-09
### Added
- Version update progress metric capture.
### Changed
- Optimized CSS files.
## [0.11.0] - 2017-02-07
### Added
- Better langauge support with the addition of 20 more language translations.  Arabic, Czech, Danish, Greek, Estonian, Finnish, Hebrew, Hungarian, Croatian, Indonesian, Latvian, Dutch, Norwegian, Romanian, Slovak, Swedish, Thai, Turkish, Ukrainian, and Vietnamese!  
## [0.10.0] - 2017-01-30
### Added
- This release includes a lot of UI changes, hopefully, all to the better.  The color scheme has changed slightly to match that of the main NiM icon.  A floating material style button has been added to the lower right corner of the popup to facilitate access to current and possible future features without being disruptive to the UI.  Currently, there is a button for the settings modal as well as well as a button for a new feature, the notification area.  Again, the notification area was meant to be very non-intrusive and to allow for easier communication to users about important issues.  Finally a Google+ Platform link was added to make it even easier to add those stellar reviews and 5 star ratings <i class=\"emo-thumbsup\"></i>.  The donation link was also changed partially in response to user feedback about making some additions to that area.

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
