module.exports = (function Selenium() {
    const EXTENSIONID = 'mbopjbbkmnhlhjcjhpblogndilpmcfnc';
    var webdriver = require('selenium-webdriver');
    var chromedriver = require('selenium-webdriver/chrome');
    var options = new chromedriver.Options();

    options.addArguments('load-extension=D:/code/NIM');
    options.addArguments("disable-infobars");
    options.excludeSwitches(['test-type']);

    var driver = new webdriver.Builder().setChromeOptions(options).forBrowser('chrome').build();
    
    driver.get('chrome-extension://'+EXTENSIONID+'/popup.html');
    //var button = driver.wait(until.elementLocated(webdriver.By.id('autoManualSwitch')));
    var button = driver.wait(new webdriver.Condition('elementToBeClickable', webdriver.By.id('autoManualSwitch')));
    button.click();
            // Test loop to ensure that only a single tab is being created and that functionality is otherwise working correctly.  Should not create duplicate tabs.
    driver.executeScript('chrome.runtime.onConnectExternal.addListener(function(port) {\
      port.onMessage.addListener(function(msg) {\
        // See other examples for sample onMessage handlers.\
        console.log(\'Connected message: \');\
        console.dir(msg);\
      });\
    })');

    driver.quit();
})();
