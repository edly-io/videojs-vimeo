/* The MIT License (MIT)

Copyright (c) 2020-2021 Zia Fazal <zia.fazal@edly.io>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */
/*global define, Vimeo*/
(function (root, factory) {
  if(typeof exports==='object' && typeof module!=='undefined') {
    var videojs = require('video.js');
    module.exports = factory(videojs.default || videojs);
  } else if(typeof define === 'function' && define.amd) {
    define(['videojs'], function(videojs){
      return (root.Vimeo = factory(videojs));
    });
  } else {
    root.Vimeo = factory(root.videojs);
  }
}(this, function(videojs) {
  'use strict';

  var _isOnMobile = videojs.browser.IS_IOS || videojs.browser.IS_NATIVE_ANDROID;
  var Tech = videojs.getTech('Tech');
  var VimeoState = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3
  };  

  var VimeoTech = videojs.extend(Tech, {

    constructor: function(options, ready) {
      Tech.call(this, options, ready);

      this.setPoster(options.poster);
      this.setSrc(this.options_.source, true);

      // Set the vjs-vimeo class to the player
      // Parent is not set yet so we have to wait a tick
      this.setTimeout(function() {
        if (this.el_) {
          this.el_.parentNode.className += ' vjs-vimeo';

          if (_isOnMobile) {
            this.el_.parentNode.className += ' vjs-vimeo-mobile';
          }

          if (VimeoTech.isApiReady) {
            this.initVimeoPlayer();
          } else {
            VimeoTech.apiReadyQueue.push(this);
          }
        }
      }.bind(this));
    },

    dispose: function() {
      if (this.vimeoPlayer) {
        //Dispose of the Vimeo Player
        if (this.vimeoPlayer) {
          this.vimeoPlayer.pause();
          this.vimeoPlayer.destroy();
        }
      } else {
        //Vimeo API hasn't finished loading or the player is already disposed
        var index = VimeoTech.apiReadyQueue.indexOf(this);
        if (index !== -1) {
          VimeoTech.apiReadyQueue.splice(index, 1);
        }
      }
      this.vimeoPlayer = null;

      this.el_.parentNode.className = this.el_.parentNode.className
        .replace(' vjs-vimeo', '')
        .replace(' vjs-vimeo-mobile', '');
      this.el_.parentNode.removeChild(this.el_);
    },

    createEl: function() {
      var div = document.createElement('div');
      div.setAttribute('id', this.options_.techId);
      div.setAttribute('style', 'width:100%;height:100%;top:0;left:0;position:absolute');
      div.setAttribute('class', 'vjs-tech');

      var divWrapper = document.createElement('div');
      divWrapper.appendChild(div);

      return divWrapper;
    },

    initVimeoPlayer: function() {
      var playerConfig = {
        controls: false,
        responsive: true,
        dnt: false,
        autoplay: false,
        muted: false,
        pip: true,
        loop: this.options_.loop ? true : false
      };

      if (typeof this.options_.autoplay !== 'undefined') {
        playerConfig.autoplay = this.options_.autoplay;
        playerConfig.muted = this.options_.autoplay;
      }

      if (typeof this.options_.responsive !== 'undefined') {
        playerConfig.responsive = this.options_.responsive;
      }

      if (typeof this.options_.pip !== 'undefined') {
        playerConfig.pip = this.options_.pip;
      }

      if (typeof this.options_.source !== 'undefined') {
        playerConfig.url = this.options_.source.src;
        this.videoId = this.options_.source.src;
      }

      this.vimeoPlayer = new Vimeo.Player(this.options_.techId, playerConfig);
      this.vimeoInfo = {
        state: VimeoState.UNSTARTED,
        volume: playerConfig.muted ? 0 : 1,
        muted: playerConfig.muted,
        time: 0,
        duration: 0,
        buffered: 0,
        isfullscreen: false
      };
      this.vimeoPlayer.on('playbackratechange', this.onPlayerPlaybackRateChange.bind(this));
      this.vimeoPlayer.on('volumechange', this.onPlayerVolumeChange.bind(this));
      this.vimeoPlayer.on('timeupdate', this.onPlayerTimeUpdate.bind(this));
      this.vimeoPlayer.on('ended', this.onPlaybackEnded.bind(this));
      this.vimeoPlayer.on('playing', this.onPlaying.bind(this));
      this.vimeoPlayer.on('play', this.onPlay.bind(this));
      this.vimeoPlayer.on('bufferstart', this.onBuffering.bind(this));
      this.vimeoPlayer.on('bufferend', this.onBufferEnd.bind(this));
      this.vimeoPlayer.on('error', this.onPlayerError.bind(this));
      this.vimeoPlayer.on('loaded', this.onPlayerReady.bind(this));
    },

    onPlayerReady: function() {
      if (this.options_.muted) {
        this.setMuted(true);
      }

      this.playerReady_ = true;
      this.triggerReady();

      if (this.playOnReady) {
        var this_ = this;
        // when autoplay is enabled we have to call play after a delay
        setTimeout(function(){
          this_.play();
        }, 600);
      }
    },

    onPlayerPlaybackRateChange: function() {
      this.trigger('ratechange');
    },

    onPlaying: function() {
      this.vimeoInfo.state = VimeoState.PLAYING;
      this.trigger('play');
    },

    onPlay: function() {
      this.vimeoInfo.state = VimeoState.PLAYING;
      this.trigger('play');
    },

    onBuffering: function() {
      this.vimeoInfo.state = VimeoState.BUFFERING;
      this.trigger('waiting');
    },

    onBufferEnd: function() {
      this.vimeoInfo.state = VimeoState.PLAYING;
      this.trigger('play');
    },

    onPlayerVolumeChange: function(data) {
      this.vimeoInfo.volume = data.volume;
      this.trigger('volumechange');
    },

    onPlayerTimeUpdate: function(data) {
        var durationChanged = this.vimeoInfo.duration !== Math.round(data.duration)
        this.vimeoInfo.time = data.seconds;
        this.vimeoInfo.duration = Math.round(data.duration);
        this.vimeoInfo.buffered = data.percent;
        this.trigger('timeupdate');
        this.trigger('progress');
        if (durationChanged) this.trigger('durationchange');
    },

    onPlaybackEnded: function(data) {
      this.vimeoInfo.state = VimeoState.ENDED;
      this.trigger('ended');
    },

    onPlayerError: function(e) {
      this.errorName = e.name;
      this.errorMethod = e.method;
      this.errorMessage = e.message;
      this.trigger('pause');
      this.trigger('error');
    },

    error: function() {
      var code = this.errorName + ' ' + this.errorMethod;
      return { code: code, message: this.errorMessage };
    },

    src: function(src) {
      if (src) {
        this.setSrc({ src: src });
      }

      return this.source;
    },

    setSrc: function(source) {
      if (!source || !source.src) {
        return;
      }

      delete this.errorName;
      this.source = source;

      if (this.options_.autoplay && !_isOnMobile) {
        if (this.isReady_) {
          this.play();
        } else {
          this.playOnReady = true;
        }
      }
    },

    autoplay: function() {
      return this.options_.autoplay;
    },

    setAutoplay: function(val) {
      this.options_.autoplay = val;
    },

    loop: function() {
      return this.options_.loop;
    },

    setLoop: function(val) {
      this.options_.loop = val;
    },

    playVimeo_: function() {
      var this_ = this;
      this.vimeoPlayer.play().then(function() {
        this_.vimeoInfo.state = VimeoState.PLAYING;
        this_.vimeoInfo.firstTimePlay = false;
        this_.trigger('play');
      }).catch(function(error) {
        console.log(error);
      });
    },

    play: function() {
      if (!this.videoId) {
        return;
      }

      if (this.isReady_) { 
        var this_ = this;
        if (this.playOnReady) { // video is playing for first time and autoplay is true then we have play it in muted
          this.vimeoPlayer.setMuted(true).then(function() {
            this_.playOnReady = false;
            this_.playVimeo_();  
          });          
        }
        else {
          this.playVimeo_();          
        }
      } else {
        this.trigger('waiting');
        this.playOnReady = true;
      }
    },

    pause: function() {
      if (this.vimeoPlayer) {
        var this_ = this;
        this.vimeoPlayer.pause().then(function() {
          this_.vimeoInfo.state = VimeoState.PAUSED;
          this_.trigger('pause');
        });        
      }
    },

    paused: function() {
      return this.vimeoInfo.state !== VimeoState.PLAYING && this.vimeoInfo.state !== VimeoState.BUFFERING;
    },

    currentTime: function() {
      return this.vimeoInfo.time;
    },

    setCurrentTime: function(seconds) {
      if (this.vimeoPlayer) {
        this.vimeoPlayer.setCurrentTime(seconds);
      }
    },

    duration: function() {
      return this.vimeoInfo.duration;
    },

    currentSrc: function() {
      return this.source && this.source.src;
    },

    ended: function() {
      if (this.vimeoPlayer) {
        return this.vimeoInfo.state === VimeoState.ENDED;
      }
    },

    volume: function() {
      if (this.vimeoPlayer) {
        return this.vimeoInfo.volume;
      }
    },

    setVolume: function(percentAsDecimal) {
      if (this.vimeoPlayer) {
        var this_ = this;
        this.vimeoPlayer.setVolume(percentAsDecimal).then(function() {
          this_.vimeoInfo.volume = percentAsDecimal;
          this_.trigger('volumechange');
        } );
      }
    },

    muted: function() {
      if (this.vimeoPlayer) {
        return this.vimeoInfo.muted;
      }
    },

    setMuted: function(mute) {
      if (this.vimeoPlayer) {
        var this_ = this;
        this.vimeoPlayer.setMuted(mute).then(function() {
          this_.vimeoInfo.muted = mute;
          this_.muted(true);
          this_.trigger('volumechange');
        });
      }
    },


    buffered: function() {
      if (this.vimeoPlayer) {
        return videojs.createTimeRange(0, (this.vimeoInfo.buffered*this.vimeoInfo.duration));
      }
    },

    supportsFullScreen: function() {
      return true;
    }
  });

  VimeoTech.isSupported = function() {
    return true;
  };

  VimeoTech.canPlaySource = function(e) {
    return VimeoTech.canPlayType(e.type);
  };

  VimeoTech.canPlayType = function(e) {
    return (e === 'video/vimeo');
  };

  function apiLoaded() {
    VimeoTech.isApiReady = true;
    for (var i = 0; i < VimeoTech.apiReadyQueue.length; ++i) {
      VimeoTech.apiReadyQueue[i].initVimeoPlayer();
    }
  }

  function loadScript(src, callback) {
    var loaded = false;
    var tag = document.createElement('script');
    var firstScriptTag = document.getElementsByTagName('script')[0];
    if (!firstScriptTag) {
      return;
    }
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    tag.onload = function () {
      if (!loaded) {
        loaded = true;
        callback();
      }
    };
    tag.onreadystatechange = function () {
      if (!loaded && (this.readyState === 'complete' || this.readyState === 'loaded')) {
        loaded = true;
        callback();
      }
    };
    tag.src = src;
  }

  function injectCss() {
    var css = '.vjs-vimeo-mobile .vjs-big-play-button { display: none; }';

    var head = document.head || document.getElementsByTagName('head')[0];

    var style = document.createElement('style');
    style.type = 'text/css';

    if (style.styleSheet){
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }

    head.appendChild(style);
  }

  VimeoTech.apiReadyQueue = [];

  if (typeof document !== 'undefined'){
    loadScript('https://player.vimeo.com/api/player.js', apiLoaded);
    injectCss();
  }

  // Older versions of VJS5 doesn't have the registerTech function
  if (typeof videojs.registerTech !== 'undefined') {
    videojs.registerTech('Vimeo', VimeoTech);
  } else {
    videojs.registerComponent('Vimeo', VimeoTech);
  }
}));
