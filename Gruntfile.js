module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt, {
      pattern: ['grunt-*', 'gruntify-*']
  });
  var pkg = grunt.file.readJSON('package.json');
  var mnf = grunt.file.readJSON('manifest.json');
  var fileMaps = {
    transpile: {},
    uglify: {}
  };
  var jsDeps = [
              'angular.min.js',
              'angular-animate.min.js',
              'angular-moment.min.js',
              'bootstrap-notify.min.js',
              'jquery.min.js',
              'materialize.min.js',
              'moment.min.js',
              'nouislider.min.js',
              'perfect-scrollbar.jquery.min.js',
              'perfect-scrollbar.min.js',
              'wnumb.js'
  ];
  jsDeps;
  fileMaps.uglify['build/unpacked-prod/js/wnumb.min.js'] = 'build/unpacked-dev/js/wnumb.js';
  fileMaps.uglify['build/unpacked-prod/js/googleanalytics.min.js'] = 'build/unpacked-dev/js/googleanalytics.js';
  fileMaps.uglify['build/unpacked-prod/background.min.js'] = 'build/unpacked-dev/background.js';
  fileMaps.uglify['build/unpacked-prod/popup.min.js'] = 'build/unpacked-dev/popup.js';
  fileMaps.uglify['build/unpacked-prod/options.min.js'] = 'build/unpacked-dev/options.js';
  grunt.initConfig({
      clean: [ 'build/**/*'],
      mkdir: {
          unpacked: {
              options: {
                  create: ['build/unpacked-dev', 'build/unpacked-prod']
              }
          },
          js: {
              options: {
                  create: ['build/unpacked-dev/js']
              }
          }
      },
      eslint: {
          options: {
              configFile: ".eslintrc"
          },
          src: ['package.json', 'lint-options.json', 'Gruntfile.js', '*.js', '*.json']
      },
      mochaTest: {
          options: {
              colors: true,
              reporter: 'spec'
          },
          files: ['**/*.spec.js']
      },
      processhtml: {
        dist: {
          files: {
            'build/unpacked-prod/background.html': ['build/unpacked-dev/background.html'],
            'build/unpacked-prod/popup.html': ['build/unpacked-dev/popup.html'],
            'build/unpacked-prod/options.html': ['build/unpacked-dev/options.html']
          }
        },
        min: {
          files: {
            'build/unpacked-prod/background.html': ['build/unpacked-dev/background.html'],
            'build/unpacked-prod/popup.html': ['build/unpacked-dev/popup.html'],
            'build/unpacked-prod/options.html': ['build/unpacked-dev/options.html']
          }
        }
      },
      copy: {
        main: {
          files: [{
              expand: true,
              src: ['js/**/*.js', '*.js', '*.html', 'css/**/*.css', '*.css', 'icon/*', 'font/*', 'image/*', 'manifest.json', 'LICENSE', '_locales/**/*', '!Gruntfile.js', '!i18n_config.js', '!notifications*.js'],
              dest: 'build/unpacked-dev/' },
          { expand: true,
            cwd: 'css/vendor/',
            src: 'font/**',
            dest: 'build/unpacked-dev/' }]
        },
        prod: {
          files: [{
              expand: true,
              cwd: 'build/unpacked-dev/',
              src: ['js/**/*.js', '*.js', 'icon/*', 'font/*', 'image/*', 'manifest.json', 'LICENSE', '_locales/**/*', '!js/dev/**'],
              dest: 'build/unpacked-prod/' },
          { expand: true,
            cwd: 'css/vendor/',
            src: 'font/**',
            dest: '/build/unpacked-prod/' }]
        },
        min: {
          files: [{
              expand: true,
              cwd: 'build/unpacked-dev/',
              src: ['js/**/*.min.js', 'icon/*', 'font/*', 'image/*', 'manifest.json', 'LICENSE', '_locales/**/*', '!js/dev/**'],
              dest: 'build/unpacked-prod/' },
          { expand: true,
            cwd: 'build/unpacked-dev/css/',
            src: ['nim.min.css', 'vendor-options.min.css', 'vendor-popup.min.css', 'vendor.min.css'],
            dest: 'build/unpacked-prod/css/' }]
        },
        artifact: {
          files: [{
              expand: true,
              cwd: 'build/',
              src: [pkg.name + '-' + pkg.version + '.crx'],
              dest: process.env.CIRCLE_ARTIFACTS
          }]
        }
      },
      exec: {
          crx: {
              command: [
                '"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" --pack-extension=D:/code/nim/build/unpacked-prod',
                'move D:\\code\\nim\\build\\unpacked-prod.crx D:\\code\\nim\\build\\' + pkg.name + '-' + pkg.version + '.crx',
                'move D:\\code\\nim\\build\\unpacked-prod.pem D:\\code\\nim\\build\\' + pkg.name + '-' + pkg.version + '.pem'
              ].join(' & ')
          },
          crxosx: {
            command: [
              '"/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome" --pack-extension=build/unpacked-prod',
                'mv build/unpacked-prod.crx build/' + pkg.name + '-' + pkg.version + '.crx',
                'mv build/unpacked-prod.pem build/' + pkg.name + '-' + pkg.version + '.pem'
              ].join(' && ')
          }
      },
      compress: {
        main: {
          options: { archive: './build/' + pkg.name + '-' + pkg.version + '.zip', mode: 'zip' },
          files: [ { expand: true, cwd: './build/unpacked-prod/', src: ['**'] } ]
        }
      },
      babel: {
        options: {
          sourceMap: true,
          presets: ['babel-preset-env']
        },
        dist: {
          files: [
            { 'build/unpacked-dev/background.js': 'background.js' }, 
            { 'build/unpacked-dev/popup.js': 'popup.js' },
            { 'build/unpacked-dev/options.js': 'options.js' }
          ]
        }
      },
      uglify: {
          min: {
              files: fileMaps.uglify
          }
      },
      cssmin: {
        target: {
          files: [ 
            { 'build/unpacked-dev/css/vendor-popup.min.css' : 'css/vendor/popup/*.css' },
            { 'build/unpacked-dev/css/vendor-options.min.css' : 'css/vendor/options/*.css' },
            { 'build/unpacked-dev/css/vendor.min.css' : 'css/vendor/*.css' },
            { 'build/unpacked-dev/css/nim.min.css' : 'css/*.css' }
          ]
        }
      },
      'string-replace': {
        dist: {
          files: {
            'build/unpacked-dev/': 'background.js',
          },
          options: {
            replacements: [{
              pattern: /const VERSION \= \'\'/,
              replacement: 'const VERSION = \''+ pkg.version +'\''
            },
            { pattern: /debugVerbosity: [0-9]/,
              replacement: 'debugVerbosity: 0'
            },
            { pattern: /const DEVEL \= true/,
              replacement: 'const DEVEL = false'
            }]
          }
        }
      },
      watch: {
          js: {
              files: ['package.json', 'lint-options.json', 'Gruntfile.js', '**/*.js', '**/*.json'],
              tasks: ['test']
          }
      },
      npmcopy: {
        js: {
          options: {
              // Task-specific options go here 
              destPrefix: "js"
          },
          files: {
              // Target-specific file lists and/or options go here 
              'angular.min.js': 'angular/angular.min.js',
              'angular-animate.min.js': 'angular-animate/angular-animate.min.js',
              'angular-moment.min.js': 'angular-moment/angular-moment.min.js',
              'bootstrap-notify.min.js': 'bootstrap-notify/bootstrap-notify.min.js',
              'jquery.min.js': 'jquery/dist/jquery.min.js',
              'materialize.min.js': 'materialize-css/dist/js/materialize.min.js',
              'moment.min.js': 'moment/min/moment.min.js',
              'nouislider.min.js': 'nouislider/distribute/nouislider.min.js',
              'perfect-scrollbar.jquery.min.js': 'perfect-scrollbar/dist/js/perfect-scrollbar.jquery.min.js',
              'perfect-scrollbar.min.js': 'perfect-scrollbar/dist/js/perfect-scrollbar.min.js',
              'wnumb.js': 'wnumb/wNumb.js'
          }
        },
        css: {
          options: {
              // Task-specific options go here 
              destPrefix: "css/vendor"
          },
          files: {
              // Target-specific file lists and/or options go here
              'materialize.css': 'materialize-css/dist/css/materialize.css',
              'options/nouislider.css': 'nouislider/distribute/nouislider.css',
              'popup/animate.min.css': 'animate.css/animate.min.css',
              'popup/bootstrap.min.css': 'bootstrap/dist/css/bootstrap.min.css',
              'popup/perfect-scrollbar.css': 'perfect-scrollbar/dist/css/perfect-scrollbar.css',
          }
        }
      }
  });
  grunt.registerTask(
      'manifest', 'Extend manifest.json with extra fields from package.json',
      function () {
          var fields = ['version'];
          for (var i = 0; i < fields.length; i++) {
              var field = fields[i];
              mnf[field] = pkg[field];
          }
          grunt.file.write('build/unpacked-dev/manifest.json', JSON.stringify(mnf, null, 4) + '\n');
          grunt.log.ok('manifest.json generated');
      }
  );
  grunt.registerTask(
      'circleci', 'Store built extension as CircleCI arfitact',
      function () {
          if (process.env.CIRCLE_ARTIFACTS) {
              grunt.task.run('copy:artifact');
          }
          else {
              grunt.log.ok('Not on CircleCI, skipped');
          }
      }
  );
  grunt.registerTask('test', ['eslint']);
  grunt.registerTask('test-cont', ['test', 'watch']);
  grunt.registerTask('default', ['clean', 'npmcopy', 'test', 'mkdir:unpacked', 'copy:main', 'manifest', 'mkdir:js', 'string-replace', 'processhtml:dist', 'processhtml:min', 'cssmin', 'babel', 'uglify', 'copy:min', 'exec:crx', 'compress']);
  grunt.registerTask('defaultosx', ['clean', 'npmcopy', 'test', 'mkdir:unpacked', 'copy:main', 'manifest', 'mkdir:js', 'string-replace', 'processhtml:dist', 'processhtml:min', 'cssmin', 'babel', 'uglify', 'copy:min', 'exec:crxosx', 'compress']);
  grunt.file.write('build/unpacked-dev/manifest.json', JSON.stringify(mnf, null, 4) + '\n');
  grunt.log.ok('manifest.json generated');
}