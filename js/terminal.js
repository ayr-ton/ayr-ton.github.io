var util = util || {};
util.toArray = function(list) {
  return Array.prototype.slice.call(list || [], 0);
};

// Cross-browser impl to get document's height.
util.getDocHeight = function() {
  var d = document;
  return Math.max(
      Math.max(d.body.scrollHeight, d.documentElement.scrollHeight),
      Math.max(d.body.offsetHeight, d.documentElement.offsetHeight),
      Math.max(d.body.clientHeight, d.documentElement.clientHeight)
  );
};

var Terminal = Terminal || function(containerId) {
  window.URL = window.URL || window.webkitURL;

  const VERSION_ = '0.6.1';
  const CMDS_ = [
    'blog', 'clear', 'help', 'theme', 'version', 
	  'who' 
  ];
  const THEMES_ = ['default', 'cream'];

  var history_ = [];
  var histpos_ = 0;
  var histtemp_ = 0;

  var timer_ = null;
  var magicWord_ = null;

  var fsn_ = null;
  var is3D_ = false;

  // Create terminal and cache DOM nodes;
  var container_ = document.getElementById(containerId);
  container_.insertAdjacentHTML('beforeEnd',
      ['<output></output>',
       '<div id="input-line" class="input-line">',
       '<div class="prompt">$&gt;</div><div><input class="cmdline" autofocus /></div>',
       '</div>'].join(''));
  var cmdLine_ = container_.querySelector('#input-line .cmdline');
  var output_ = container_.querySelector('output');
  var interlace_ = document.querySelector('.interlace');

  // Hackery to resize the interlace background image as the container grows.
  output_.addEventListener('DOMSubtreeModified', function(e) {
    var docHeight = util.getDocHeight();
    document.documentElement.style.height = docHeight + 'px';
    //document.body.style.background = '-webkit-radial-gradient(center ' + (Math.round(docHeight / 2)) + 'px, contain, rgba(0,75,0,0.8), black) center center no-repeat, black';
    interlace_.style.height = docHeight + 'px';
    setTimeout(function() { // Need this wrapped in a setTimeout. Chrome is jupming to top :(
      //window.scrollTo(0, docHeight);
      cmdLine_.scrollIntoView();
    }, 0);
    //window.scrollTo(0, docHeight);
  }, false);

  output_.addEventListener('click', function(e) {
    var el = e.target;
    if (el.classList.contains('file') || el.classList.contains('folder')) {
      cmdLine_.value += ' ' + el.textContent;
    }
  }, false);

  window.addEventListener('click', function(e) {
    //if (!document.body.classList.contains('offscreen')) {
      cmdLine_.focus();
    //}
  }, false);

  // Always force text cursor to end of input line.
  cmdLine_.addEventListener('click', inputTextClick_, false);

  // Handle up/down key presses for shell history and enter for new command.
  cmdLine_.addEventListener('keydown', keyboardShortcutHandler_, false);
  cmdLine_.addEventListener('keyup', historyHandler_, false); // keyup needed for input blinker to appear at end of input.
  cmdLine_.addEventListener('keydown', processNewCommand_, false);

  /*window.addEventListener('beforeunload', function(e) {
    return "Don't leave me!";
  }, false);*/

  function inputTextClick_(e) {
    this.value = this.value;
  }

  function keyboardShortcutHandler_(e) {
    // Toggle CRT screen flicker.
    if ((e.ctrlKey || e.metaKey) && e.keyCode == 83) { // crtl+s
      container_.classList.toggle('flicker');
      output('<div>Screen flicker: ' +
             (container_.classList.contains('flicker') ? 'on' : 'off') +
             '</div>');
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function historyHandler_(e) { // Tab needs to be keydown.

    if (history_.length) {
      if (e.keyCode == 38 || e.keyCode == 40) {
        if (history_[histpos_]) {
          history_[histpos_] = this.value;
        } else {
          histtemp_ = this.value;
        }
      }

      if (e.keyCode == 38) { // up
        histpos_--;
        if (histpos_ < 0) {
          histpos_ = 0;
        }
      } else if (e.keyCode == 40) { // down
        histpos_++;
        if (histpos_ > history_.length) {
          histpos_ = history_.length;
        }
      }

      if (e.keyCode == 38 || e.keyCode == 40) {
        this.value = history_[histpos_] ? history_[histpos_] : histtemp_;
        this.value = this.value; // Sets cursor to end of input.
      }
    }
  }

  function processNewCommand_(e) {

    if (e.keyCode == 9) { // Tab
      e.preventDefault();
      // TODO(ericbidelman): Implement tab suggest.
    } else if (e.keyCode == 13) { // enter

      // Save shell history.
      if (this.value) {
        history_[history_.length] = this.value;
        histpos_ = history_.length;
      }

      // Duplicate current input and append to output section.
      var line = this.parentNode.parentNode.cloneNode(true);
      line.removeAttribute('id')
      line.classList.add('line');
      var input = line.querySelector('input.cmdline');
      input.autofocus = false;
      input.readOnly = true;
      output_.appendChild(line);

      // Parse out command, args, and trim off whitespace.
      // TODO(ericbidelman): Support multiple comma separated commands.
      if (this.value && this.value.trim()) {
        var args = this.value.split(' ').filter(function(val, i) {
          return val;
        });
        var cmd = args[0].toLowerCase();
        args = args.splice(1); // Remove cmd from arg list.
      }

      switch (cmd) {
        case 'blog':
          clear_(this);
          output('Hold on to your butts!');
          toggle3DView_();
          break;
        case 'clear':
          clear_(this);
          return;
        case 'exit':
          if (is3D_) {
            toggle3DView_();
          }
          if (timer_ != null) {
            magicWord_.stop();
            clearInterval(timer_);
          }
          break;
        case 'help':
          output('<div class="ls-files">' + '<br>' + CMDS_.join('<br>') + '</div>');
          output('<p>There\'s some other available commands. Use your imagination :-)</p>');
          break;
        case 'init':
          if (worker_) {
            worker_.postMessage({cmd: 'init', type: type_, size: size_});
          }
          break;
        case 'sudo':
          if (timer_ != null) {
            magicWord_.stop();
            clearInterval(timer_);
          }
          if (!magicWord_) {
            magicWord_ = new Sound(true);
            magicWord_.load('magic_word.mp3', false, function() {
              magicWord_.play();
            });
          } else {
            magicWord_.play();
          }
          timer_ = setInterval(function() {
            output("<div>YOU DIDN'T SAY THE MAGIC WORD!</div>");
          }, 100);
          break;
        case 'theme':
          var theme = args.join(' ');
          if (!theme) {
            output(['usage: ', cmd, ' ' + THEMES_.join(',')].join(''));
          } else {
            if (THEMES_.indexOf(theme) != -1) {
              setTheme_(theme);
            } else {
              output('Error - Unrecognized theme used');
            }
          }
          break;
        case 'version':
        case 'ver':
          output(VERSION_);
          break;
        case 'who':
          output(document.title +
                 ' - By: Ayrton Araujo &lt;root@ayrtonaraujo.net&gt;');
          break;
        default:
          if (cmd) {
            output(cmd + ': command not found');
          }
      };

      this.value = ''; // Clear/setup line for next input.
    }
  }

  function formatColumns_(entries) {
    var maxName = entries[0].name;
    util.toArray(entries).forEach(function(entry, i) {
      if (entry.name.length > maxName.length) {
        maxName = entry.name;
      }
    });

    // If we have 3 or less entries, shorten the output container's height.
    // 15px height with a monospace font-size of ~12px;
    var height = entries.length == 1 ? 'height: ' + (entries.length * 30) + 'px;' :
                 entries.length <= 3 ? 'height: ' + (entries.length * 18) + 'px;' : '';

    // ~12px monospace font yields ~8px screen width.
    var colWidth = maxName.length * 16;//;8;

    return ['<div class="ls-files" style="-webkit-column-width:',
            colWidth, 'px;', height, '">'];
  }

  function clear_(input) {
    output_.innerHTML = '';
    input.value = '';
    document.documentElement.style.height = '100%';
    interlace_.style.height = '100%';
  }

  function setTheme_(theme) {
    var currentUrl = document.location.pathname;

    if (!theme || theme == 'default') {
      //history.replaceState({}, '', currentUrl);
      localStorage.removeItem('theme');
      document.body.className = '';
      return;
    }

    if (theme) {
      document.body.classList.add(theme);
      localStorage.theme = theme;
      //history.replaceState({}, '', currentUrl + '#theme=' + theme);
    }
  }

  function toggle3DView_() {
    var body = document.body;
    body.classList.toggle('offscreen');

    is3D_ = !is3D_;

    if (body.classList.contains('offscreen')) {

      container_.style.webkitTransform =
          'translateY(' + (util.getDocHeight() - 175) + 'px)';

      var transEnd_ = function(e) {
        var iframe = document.createElement('iframe');
        iframe.id = 'fsn';
        iframe.src = 'http://blog.ayrtonaraujo.net/';

        fsn_ = body.insertBefore(iframe, body.firstElementChild);

        iframe.contentWindow.onload = function() {
          worker_.postMessage({cmd: 'read', type: type_, size: size_});
        }
        container_.removeEventListener('webkitTransitionEnd', transEnd_, false);
      };
      container_.addEventListener('webkitTransitionEnd', transEnd_, false);
    } else {
      container_.style.webkitTransform = 'translateY(0)';
      body.removeChild(fsn_);
      fsn_ = null;
    }
  }

  function output(html) {
    output_.insertAdjacentHTML('beforeEnd', html);
    //output_.scrollIntoView();
    cmdLine_.scrollIntoView();
  }

  return {
    initFS: function() {
      output('<div>Welcome to ' + document.title +
             ' \\o/ (v' + VERSION_ + ')</div>');
      output((new Date()).toLocaleString());
      output('<p>Documentation: type "help"</p>');
    },
    output: output,
    setTheme: setTheme_,
    getCmdLine: function() { return cmdLine_; },
    toggle3DView: toggle3DView_
  }
};
