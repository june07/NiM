module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt, {
      pattern: ['grunt-*', 'gruntify-*']
  });
  var pkg = grunt.file.readJSON('package.json');
  var mnf = grunt.file.readJSON('manifest.json');
  var fileMaps = {
      browserify: {},
      uglify: {}
  };
  var file, files = grunt.file.expand({}, ['js/**/*.js, *.js']);
  for (var i = 0; i < files.length; i++) {
      file = files[i];
      fileMaps.browserify['build/unpacked-dev/js/' + file] = 'js/' + file;
      fileMaps.uglify['build/unpacked-prod/js/' + file] = 'build/unpacked-dev/js/' + file;
  }
  grunt.initConfig({
      clean: ['build/unpacked-dev', 'build/unpacked-prod', 'build/*'],
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
      copy: {
        main: {
          files: [{
              expand: true,
              src: ['js/**/*.js', '*.js', '*.html', 'css/**/*.css', '*.css', 'icon/*', 'manifest.json', 'LICENSE'],
              dest: 'build/unpacked-dev/'
          }]
        },
        prod: {
          files: [{
              expand: true,
              cwd: 'build/unpacked-dev/',
              src: ['js/**/*.js', '*.js', '*.html', 'css/**/*.css', '*.css', 'icon/*', 'manifest.json', 'LICENSE'],
              dest: 'build/unpacked-prod/'
          }]
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
      browserify: {
          build: {
              files: fileMaps.browserify,
              options: {
                  browserifyOptions: {
                      debug: true, // for source maps
                      standalone: pkg['export-symbol']
                  }
              }
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
      },
      compress: {
        main: {
          options: { archive: './build/' + pkg.name + '-' + pkg.version + '.zip', mode: 'zip' },
          files: [ { expand: true, cwd: './build/unpacked-prod/', src: ['**'] } ]
        }
      },
      uglify: {
          min: {
              files: fileMaps.uglify
          }
      },
      watch: {
          js: {
              files: ['package.json', 'lint-options.json', 'Gruntfile.js', '**/*.js',
          '**/*.json'],
              tasks: ['test']
          }
      }
  });
  grunt.registerTask(
      'manifest', 'Extend manifest.json with extra fields from package.json',
      function () {
          var fields = ['name', 'version', 'description'];
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
  grunt.registerTask('default', ['clean', 'test', 'mkdir:unpacked', 'copy:main', 'manifest', 'mkdir:js', 'browserify', 'copy:prod', 'uglify', 'exec', 'compress']);
  grunt.file.write('build/unpacked-dev/manifest.json', JSON.stringify(mnf, null, 4) + '\n');
  grunt.log.ok('manifest.json generated');
}