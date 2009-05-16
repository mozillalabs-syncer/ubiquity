var App = {
  _jetpackLinks: {},

  removeLinkForJetpack: function removeLinkForJetpack(url) {
    if (url in this._jetpackLinks) {
      this._jetpackLinks[url].slideUp(function() { $(this).remove(); });
      delete this._jetpackLinks[url];
    }
  },

  addLinkForJetpack: function addLinkForJetpack(feed) {
    var url = feed.uri.spec;
    var link = $('<a></a>').attr('href', url).text(feed.title);
    var div = $('<div class="jetpack"></div>').append(link);
    div.hide();
    $("#jetpacks").append(div);
    div.slideDown();
    MemoryTracking.track(div, "JetpackLink");
    this._jetpackLinks[url] = div;
  },

  get isFirefoxOld() {
    var appInfo = Cc["@mozilla.org/xre/app-info;1"]
                  .getService(Ci.nsIXULAppInfo);
    var versionChecker = Cc["@mozilla.org/xpcom/version-comparator;1"]
                         .getService(Ci.nsIVersionComparator);
    if (versionChecker.compare(appInfo.version, "3.1b3") < 0)
      return true;
    return false;
  },

  // Open the view-source window. This code was taken from Firebug's source code.
  viewSource: function viewSource(url, lineNumber) {
    window.openDialog("chrome://global/content/viewSource.xul",
                      "_blank", "all,dialog=no",
                      url, null, null, lineNumber);
  },

  // Open the JS error console.  This code was largely taken from
  // http://mxr.mozilla.org/mozilla-central/source/browser/base/content/browser.js
  openJsErrorConsole: function openJsErrorConsole() {
    var wm = Cc['@mozilla.org/appshell/window-mediator;1'].getService();
    var wmInterface = wm.QueryInterface(Ci.nsIWindowMediator);
    var topWindow = wmInterface.getMostRecentWindow("global:console");

    if (topWindow)
      topWindow.focus();
    else
      window.open("chrome://global/content/console.xul", "_blank",
                  "chrome,extrachrome,menubar,resizable,scrollbars," +
                  "status,toolbar");
  },

  forceGC: function forceGC() {
    Components.utils.forceGC();
    App.tick();
  },

  functionStub: function functionStub() {},

  // A constructor for creating a stub-like copy of an object, used because
  // right now logging real objects to Firebug appears to create memory
  // leaks.
  ObjectCopy: function ObjectCopy(object) {
    function makeObjectGetter(item) {
      var originalToString = item.toString();
      var weakref = Components.utils.getWeakReference(item);
      item = null;
      return function objectGetter() {
        var retval = "[Object-deleted: " + originalToString + "]";
        var ref = weakref.get();
        if (ref) {
          retval = new App.ObjectCopy(ref);
          ref = null;
        }
        return retval;
      };
    }

    var originalToString = object.toString();

    this.toString = function toString() {
      return "[Copy-of " + originalToString + "]";
    };

    function duplicate(obj, name, value) {
      switch (typeof(value)) {
      case "object":
        if (value === null)
          obj[name] = null;
        else if (value.constructor &&
                 value.constructor.name == "Array") {
          obj[name] = [];
          for (var i = 0; i < value.length; i++)
            duplicate(obj[name], i, value[i]);
          obj[name].length = value.length;
        } else
          obj.__defineGetter__(name, makeObjectGetter(value));
        break;
      case "function":
        obj[name] = App.functionStub;
        break;
      default:
        obj[name] = value;
      }
      value = null;
      name = null;
    }

    for (name in object)
      if (name != "toString") {
        try {
          duplicate(this, name, object[name]);
        } catch (e) {
          this[name] = "[Duplicate-failed: " + e + "]";
        }
      }
    object = null;
  },

  inspectTrackedObjects: function inspectTrackedObjects(objects) {
    var newObjects = [];
    objects.forEach(
      function(object) {
        var newObject = { copy: new App.ObjectCopy(object.weakref.get()) };
        newObject.__proto__ = object;
        newObjects.push(newObject);
      });
    console.log(newObjects);
  },

  tick: function tick() {
    const ID_PREFIX = "MemoryTracking-";
    var bins = MemoryTracking.getBins();
    bins.sort();
    var newRows = $('<div></div>');
    bins.forEach(
      function(name) {
        var objects = MemoryTracking.getLiveObjects(name);
        if (objects.length == 0)
          return;
        var row = $('<div class="row"></div>');
        row.attr("id", ID_PREFIX + name);
        var binName = $('<span class="code"></span>').text(name);
        binName.css({cursor: "pointer"});
        binName.mouseup(
          function() {
            App.viewSource(objects[0].fileName, objects[0].lineNumber);
          });
        row.append(binName);
        row.append($('<span class="count"></span>').text(objects.length));
        if (window.console.isFirebug) {
          var inspectInFb = $('<span class="buttony"></span>');
          inspectInFb.text('inspect');
          inspectInFb.click(
            function() { App.inspectTrackedObjects(objects); }
          );
          row.append(inspectInFb);
        }
        newRows.append(row);
      });
    $("#extension-weakrefs").empty().append(newRows);
    bins = null;
    newRows = null;
  }
};

$(window).ready(
  function() {
    window.setInterval(App.tick, 1000);
    $("#this-page-source-code").click(
      function() {
        App.viewSource(window.location.href, null);
      });
    $("#force-gc").click(App.forceGC);
    $("#run-tests").click(function() { Tests.run(); });
    $("#display-sample").click(
      function() { $("#sample-code").slideToggle(); }
    );

    if (window.console.isFirebug) {
      $(".logging-source").text("Firebug Console");
    } else {
      $("#firebug-not-found").show();
      $(".logging-source").click(App.openJsErrorConsole);
      $(".logging-source").addClass("buttony");
      $(".logging-source").text("JS Error Console");
    }

    if (App.isFirefoxOld)
      $("#old-firefox-version").show();

    JetpackRuntime.FeedPlugin.FeedManager.getSubscribedFeeds().forEach(
      function(feed) {
        if (feed.type == "jetpack")
          App.addLinkForJetpack(feed);
      });

    function onFeedEvent(eventName, uri) {
      switch (eventName) {
      case "purge":
      case "unsubscribe":
        App.removeLinkForJetpack(uri.spec);
        break;
      case "subscribe":
        var feed = JetpackRuntime.FeedPlugin.FeedManager.getFeedForUrl(uri);
        if (feed && feed.type == "jetpack")
          App.addLinkForJetpack(feed);
        break;
      }
    }

    var watcher = new EventHubWatcher(JetpackRuntime.FeedPlugin.FeedManager);
    watcher.add("subscribe", onFeedEvent);
    watcher.add("unsubscribe", onFeedEvent);
    watcher.add("purge", onFeedEvent);
    App.forceGC();
  });
