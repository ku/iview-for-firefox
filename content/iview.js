// 
// Copyright (c) KUMAGAI Kentaro ku0522a*gmail.com
// All rights reserved.
// 
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
// 
// 
// 1. Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// 
//
( function () {
var siteinfoURL = 'http://wedata.net/databases/iview/items.json';
//var siteinfoURL = 'http://localhost/kuma/iview/content/items.json';
//var siteinfoURL = 'http://localhost/kuma/iview/content/items.online.js';

var jsonDecoder = Components.Constructor("@mozilla.org/dom/json;1", "nsIJSON");
/*
var ios = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
var prefetchService = Components.classes["@mozilla.org/prefetch-service;1"].
            getService(Components.interfaces.nsIPrefetchService);
var observerService = Components.classes["@mozilla.org/observer-service;1"]
                        .getService (Components.interfaces.nsIObserverService);
*/
var IPC = function (doc) {
	this.doc = doc;
	return this;
}
IPC.prototype.sendMessage = function (msg) {
	var request = this.doc.createEvent("DataContainerEvent");
	request.initEvent("iview-ipc-from-chromeWindow", true, false);
	request.setData("msg", msg);
	this.doc.dispatchEvent(request);
}

var log = function () {
	//Firebug.Console.log.apply(Firebug.Console, arguments);
	Firebug.Console.log(arguments);
}

var XMLHttpRequest = function () {}
XMLHttpRequest.get = function (u, onload) {
	var request = Components.
	classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
	createInstance();

	request.QueryInterface(Components.interfaces.nsIDOMEventTarget);
	// request.addEventListener("progress", function(evt) { ... }, false);
	request.addEventListener("load", onload, false);
	// request.addEventListener("error", function(evt) { ... }, false);
	
	request.QueryInterface(Components.interfaces.nsIXMLHttpRequest);

	// awesome x-user-defined suppresses mojibake!
	request.overrideMimeType('text/plain; charset=x-user-defined');
	request.open("GET", u, true);
	request.send(null);

	return request;
}

var RequestBroker = function (observer) {
	this.requestsPerSec = 5;
	this.disabled = false;
	this.observer = observer;

	this.availableSlots = 4;

	this.queues = [];

	var self = this;
	this.brokertimer = window.setInterval( function () {
		if ( self.availableSlots <= 0 )
			return;
		if ( self.disabled )
			return;

		if ( observer && observer.shouldPrefetch() ) {
			var args;

			for (var i = self.queues.length - 1; i >= 0 ; i--) {
				var q = self.queues[i];
				if ( q && q.length > 0 ) {
					args = q.shift();
					break;
				}
			}

			if ( args ) {
				var [u, opts, depth, f] = args;
				
				self.availableSlots--;
				var req = XMLHttpRequest.get(u, function () {
					try {
						self.availableSlots++;
						f.apply(observer, [req]);
					} catch(e) {
						log(e);
					}
				} );
			}
		}
	}, 1000 / this.requestsPerSec );
	return this;
}
RequestBroker.prototype.dealloc = function () {
	this.disabled = true;
	window.clearInterval(this.brokertimer);
}
RequestBroker.prototype.add = function (u, opts, depth, callback) {
	var queue = this.queues[depth];

	if ( queue ) {
		queue.push(arguments);
	} else {
		queue = this.queues[depth] = [arguments];
	} 
}

var IviewLoader = function (siteinfo, doc, eventListener) {
	this.init();

	this.siteinfo = siteinfo;
	this.doc = doc;

	this.pages = {};

	observerService.addObserver(this, this.topic, false);

	this.requestopts = {
		//charset: 'utf-8'
	};
	this.requestBroker = new RequestBroker(this);
	this.requestNextPage();
	this.eventListener = eventListener;
	return this;
}
IviewLoader.prototype.init = function () {
	this.currentPage = null;
	this.lastPageURI = null;
	this.lastPageDoc = null;

	this.PREFETCHSIZE = 20;
	this.images = [];

	this.topic = "prefetch-load-completed";

	this.imagePrefetchQueue = [];

	this.eos = false;

	this.imageURIHash = {};

	this.requestingNextPage = false;
	this.largestRequestedImageIndex = -1;
}
IviewLoader.prototype.dealloc = function () {
	this.requestBroker.dealloc();
	this.PREFETCHSIZE = -0x7ffffffff;

	observerService.removeObserver(this, this.topic);
}


IviewLoader.prototype.shouldPrefetchImage = function () {
	var n = this.largestRequestedImageIndex;
	var m = n + this.PREFETCHSIZE;
	var slots = this.images.slice(n, m);
	
	var self = this;
	var b =  slots.some( function (img) {
		var src = img.src();
		return ! self.imageURIHash[src].__prefetching;
	} );

	return b;
}
IviewLoader.prototype.shouldPrefetch = function () {
	var b = ( this.images.length - this.largestRequestedImageIndex <= this.PREFETCHSIZE ) ;
	return b;
}

IviewLoader.prototype.prefetchRequest = function (n) {
	this.getAt(n);
	if ( this.shouldPrefetchImage() ) {
		this._prefetch();
	}
}
IviewLoader.prototype.getAt = function (n) {
	if ( n < 0 ) {
		n = this.largestRequestedImageIndex;
	}
	if ( n > this.largestRequestedImageIndex ) {
		this.largestRequestedImageIndex = n;
	}
	if ( this.shouldPrefetch() ) {
	log(this, this.requestingNextPage, this.eos);
		if ( !this.requestingNextPage ) {
			this.requestNextPage();
		}
	}

	return this.images[n];
}
IviewLoader.prototype.requestNextPage = function () {
	if ( this.eos ) {
		return;
	}

	if ( this.currentPage ) {
		if ( !this.siteinfo.nextLink ) {
			return;
		}
		var xpath = this.siteinfo.nextLink;
//		log("requestNextPage", xpath, this.lastPageDoc);
		var nodes = $X(xpath, this.lastPageDoc);
//		log("requestNextPage", nodes);
		var link = nodes.shift();
		var nextLink = valueOfNode(link);

		// reaches at the end.
		if ( !nextLink ) {
			log("nextLink not found.", link, xpath);
			this.reachAtEndOfStream();
			return;
		}

		this.currentPage = abs(this.lastPageURI, nextLink);
	} else {
		this.currentPage = this.siteinfo.url;
	}

	//log("this.currentPage", this.currentPage, this.siteinfo.url, this.lastPageURI);
	var nextPage = this.currentPage;
	//log("nextPage", nextPage);
	

	this.requestingNextPage = true;
	var self = this;

	var requestopts = self.requestBroker.requestopts;
	var d = self.requestBroker.add(nextPage, requestopts, 0, function(res) {
		self.requestingNextPage = false;
		self.lastPageURI = nextPage;
		self.onPageLoad.apply(self, [res, nextPage]);
	} );

//	var obs = this.eventListener;
//	obs && obs.onRequest && obs.onRequest.apply(obs);

}
IviewLoader.prototype.onSubrequestLoad = function (res, siteinfo, seedURI, depth) {
//	log ("onSubRequestLoad", res, res.channel, res.channel.URI.asciiSpec);
	var doc = createHTMLDocumentByString(this.doc, res.responseText, res.channel.contentCharset);
	var paragraphes = $X( siteinfo.paragraph, doc );
//	log ("onSubRequest paragraphes", paragraphes);

	var base = res.channel.URI.asciiSpec;
	this.parseResponse(doc, siteinfo, base, seedURI, {
		permalink: base,
		depth: depth
	});
}
IviewLoader.prototype.onPageLoad = function (res, seedURI) {
	var siteinfo = this.siteinfo;

	var doc = this.lastPageDoc = createHTMLDocumentByString(this.doc, res.responseText, res.channel.contentCharset);
	
	// FIXME: should be requested URI.
	var base = this.lastPageURI;
	this.parseResponse(doc, siteinfo, base, seedURI);
}
IviewLoader.prototype.parseResponse = function (doc, siteinfo, baseURI, seedURI, hashTemplate) {
	hashTemplate = hashTemplate || {};
	var depth = (hashTemplate ? (hashTemplate.depth || 0) : 0 );

	var paragraphes = $X( siteinfo.paragraph, doc );

//	log("parse paragraphes", paragraphes.length, hashTemplate, siteinfo.paragraph, siteinfo, paragraphes);

	var self = this;
	var images = paragraphes.map ( function (paragraph, index) {
		var img = null;
		if ( siteinfo.subRequest && siteinfo.subRequest.paragraph ) {
			img = self.parseParagraph(paragraph, siteinfo, baseURI);

			var subpage = img.permalink;
			var requestopts = self.requestBroker.requestopts;
			var d = self.requestBroker.add(subpage, requestopts, depth + 1, function(res) {
				self.onSubrequestLoad.call(self, res, siteinfo.subRequest, seedURI, depth + 1);
			} );

//			var obs = this.eventListener;
//			obs && obs.onRequest && obs.onRequest.apply(obs);

		} else {
			if ( siteinfo.subParagraph && siteinfo.subParagraph.paragraph ) {
				var d = self.parseParagraph(paragraph, siteinfo, baseURI);

				if ( siteinfo.subParagraph.cdata ) {
					try {
						var cdata = $X( siteinfo.subParagraph.cdata, paragraph ).shift().textContent;
						cdata = '<html><body>' + cdata + '</body></html>';
						paragraph = createHTMLDocumentByString(self.doc, cdata);
					}catch(e){
						log(e);
					}
				}

				var subparagraphes = $X(siteinfo.subParagraph.paragraph, paragraph);
				subparagraphes.map ( function ( subparagraph ) {
					img = self.parseParagraph(subparagraph, siteinfo.subParagraph, baseURI);
					img = update(img, d);
					img = update(img, hashTemplate);
					self.addToImageList(img);
				} );
				img = null;
			} else {
				img = self.parseParagraph(paragraph, siteinfo, baseURI);
				img = update(img, hashTemplate);
				self.addToImageList(img);
				img.seedURI = seedURI;
			}
		}
		return img;
	} );

//	log("parse end", hashTemplate, hashTemplate.depth, hashTemplate.depth == 0);

	if ( depth == 0 ) {
		// ignore the case that zero paragraphes found in sub requests.
		if ( paragraphes.length == 0 ) {
			log("paragraphes not found.", siteinfo.paragraph, siteinfo, hashTemplate);
			this.reachAtEndOfStream();
			return;
		}
	}

	var obs = this.eventListener;
	obs && obs.onPageLoad && obs.onPageLoad.apply(obs, [this]);
}
IviewLoader.prototype.reachAtEndOfStream = function () {
	this.eos = true;
	var obs = this.eventListener;
	obs && obs.onEndOfStream && obs.onEndOfStream.apply(obs);
}

IviewLoader.prototype.observe = function (aSubject, aTopic, aContext) {
	var status = aSubject.QueryInterface(Ci.nsIDOMLoadStatus);

	var uri = aSubject.uri;
	var img = this.imageURIHash[uri];
	if ( img ) {
		var imageElement = img.node;

		if (imageElement instanceof HTMLImageElement) {
			imageElement.src = uri;
			img.__dom_load_status = status;
		} else {
			log("img.node is nto instanceof HTMLImageElement.", img, uri);
		}
	} else {
		log("prefetched but not found.", uri, this.imageURIHash);
	}
}

IviewLoader.prototype._prefetch = function () {
	var firstOne = this.imagePrefetchQueue[0];
	var img = this.imagePrefetchQueue.shift();

	if ( !img ) 
		return;

	var src = img.src();
	var permalink = img.permalink;

	
	var uri = ios.newURI(src, null, null);
	var referrer = ios.newURI(permalink, null, null);
	var sourceNode = null;
	var explicit = true;

	log ('prefetchService' , img.index, this.imagePrefetchQueue.length, firstOne, firstOne == img );

	prefetchService.prefetchURI(uri, referrer, sourceNode, explicit);

	if ( 0 ) {
		prefetchService.prefetchURIForOfflineUse(uri, referrer, sourceNode, explicit);
	}
	img.__prefetching = true;
}

IviewLoader.prototype.addToImageList = function (img) {
	var src = img.src();
	if ( ! ( src && img.permalink ) )
		return;
	
	img.feed_id = this.selectedFeedId;

	var i = new Image();
	var self = this;
	i.onload = function (ev) {
		//i.removeEventListener('load', img._load_listener, false);
		if ( self.shouldPrefetchImage() ) {
			self._prefetch();
		}
		var obs = self.eventListener;
		obs && obs.onImageLoad && obs.onImageLoad.apply(obs, [img, ev, self]);
	};
	i.onerror = function (ev) {
		var status = img.__dom_load_status.status;
		if ( 2 == Math.floor(status / 100) ) {
			// why this could be happen?
			log("onerror invoked. but request seems ended in success.",img,
				img.__dom_load_status.loadedSize, 
				img.__dom_load_status.readyState, // 3 in success
				status
			);
			//return i.onload(ev);
		} else {
			log("img.src load error.", img,
				img.__dom_load_status.loadedSize, 
				img.__dom_load_status.readyState, // 3 in success
				status
			);
		}
		img.loadErrorFlag = status;
		
		var obs = self.eventListener;
		obs && obs.onImageError && obs.onImageError.apply(obs, [img, ev, self]);
	};
	img.index = this.images.length;
	img.node = i;

	if ( this.imageURIHash[src] )
		return;

	this.images.push(img);
	this.imageURIHash[src] = img;
	this.imagePrefetchQueue.push(img);

	if ( this.shouldPrefetchImage() ) {
		this._prefetch();
	}
}

IviewLoader.prototype.parseParagraph = function (paragraph, siteinfo, baseURI) {
	var image = {
		src: function () {
			return this.imageSourceForReblog || this.imageSource;
		}
	};
	
	for ( var k in siteinfo ) {
		var xpath = siteinfo[k];

		if ( k.match(/^url|paragraph|nextLink|cdata$/) )
			continue;

		if ( !xpath || typeof xpath == 'object' ) {
			continue;
		}

		var v;
		var rs = $X(xpath, paragraph);
		if (typeof rs == 'string') {
			v = rs;
			if ( k == 'caption' ) {
				v =  v.textContent.replace(/(^\s*)|(\s*$)/g, '');
			} else {
				v = abs(baseURI, v);
			}
		} else {
			var node;
			if ( rs instanceof Array ) {
				node = rs.shift();
			} else {
				node = rs;
			}

			if ( k == 'caption' ) {
				if ( node instanceof HTMLElement )
					v =  node.textContent.replace(/(^\s*)|(\s*$)/g, '');
				else {
					v = valueOfNode(node);
				}
			} else {
				if ( node == null )
					continue;
				
				if ( node ) {
					v = valueOfNode(node);
					v = abs(baseURI, v);
				} else {
					log("node is null", paragraph, node, k);
				}
			}
		}
		image[k] = v;
	}
	return image;
}

var subscribedFeeds = {
	schema_version: 1,
	subscribed_feeds: [],
	feed_hash: {},
	init: function () {
		var ds = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties);
		var sqlitefile = ds.get("ProfD", Ci.nsIFile);
		sqlitefile.append("iview.sqlite");

		var d = this.db = new Database(sqlitefile);

		if ( !d.tableExists("photos") ) {
		log("create table 'photos'");
			d.execute(<>
			CREATE TABLE photos (
			  id        INTEGER PRIMARY KEY,
			  version     INTEGER,
			  caption      TEXT,
			  imagesource   TEXT,
			  permalink    TEXT,
			  status        INTEGER,
			  feed_id       INTEGER
			)
			</>);
		}

		if ( !d.tableExists("feeds") ) {
		log("create table 'feeds'");
			d.execute(<>
			CREATE TABLE feeds (
			  id        INTEGER PRIMARY KEY,
			  name		   TEXT,
			  version     INTEGER,
			  wedata_id      INTERGER,
			  siteinfo      TEXT,
			  subscribed_at    INTEGER
			) 
			</>);
		}

		this.Feeds = Entity( {
			name: "feeds",
			fields: {
				id:      		"INTEGER PRIMARY KEY",
				name:			"TEXT",
				version:		"INTEGER",
				wedata_id:		"INTEGER",
				siteinfo:		"TEXT",
				subscribed_at:	"INTEGER"
			}
		} );
		extend(this.Feeds, { get db() { return d} } );
	},
	dealloc: function () {
		this.db.close();
	},
	_fetchAllfeeds: function () {
		var self = this;
		var feeds = this.Feeds.findAll();
		return this.subscribed_feeds = feeds.map ( function (feed) {
				feed.__pkey_id = feed.id;
				feed.id = feed.wedata_id;
				feed.siteinfo = eval(feed.siteinfo);
				self.feed_hash[ feed.wedata_id ] = feed;
				return feed;
		} );
	},
	feeds: function () {
		var self = this;
		if ( this.subscribed_feeds.length == 0 ) {
			this._fetchAllfeeds();
		}
		return this.subscribed_feeds;
	},
	unserialize: function (flatSiteinfo) {
		var siteinfo = {};

		for ( var k in flatSiteinfo ) {
			var pathes = k.split(/\./);
			var leaf = pathes.pop();
			var hash = pathes.reduce( function(stash, name) {
				return (stash[name] || (stash[name] = {}));
			}, siteinfo);
			hash[leaf] = flatSiteinfo[k];
		};
		return siteinfo;
	},
	remove: function (feed_id) {
		var feed = this.feed_hash[feed_id];
		this.Feeds.deleteById(feed.__pkey_id);
	},
	add: function (siteinfo) {
		var self = this;
		var unserialized_siteinfo = this.unserialize(siteinfo.data);
		var d = {
			id: null,
			version: self.schema_version,
			wedata_id: siteinfo.id,
			name: siteinfo.name,
			siteinfo: uneval(unserialized_siteinfo),
			subscribed_at: parseInt(Date.now()/1000),
		};

		this.Feeds.insert(d);

		this._fetchAllfeeds();
		/*
		this.feed_hash[ siteinfo.id ] = update( d, {
			id: siteinfo.id,
			siteinfo: unserialized_siteinfo
		} );
		this.subscribed_feeds.push(siteinfo);
		*/

//		log(this, siteinfo, d );
	},
	get: function (id) {
		var feed = this.feed_hash[id];
		log("subscribedFeeds", id, feed, feed.siteinfo, this);
		if ( feed )
			return feed.siteinfo;
		else
			return null;
	}
}
/*
var iviewSiteinfo = {
	siteinfos: null,
//siteinfoURL: 'http://wedata.net/databases/iview/items.json',
//	siteinfoURL: 'http://localhost/kuma/iview/content/items.json',
	siteinfoURL: 'http://localhost/kuma/iview/content/items.online.json',
	siteinfoIdHash: null,
	init: function () {
		this.siteinfoIdHash = {};
	},
	_makeSiteinfoIdHash: function () {
		var self = this;
		var infos = this.siteinfos.map( function (info) {
			info.id = info.resource_url.replace(/\D/g, '');
			var i = self.constructTree(info.data);
			self.siteinfoIdHash[info.id] = i;
			return i;
		} );
	},
	constructTree: function (flatSiteinfo) {
		var siteinfo = {};

		for ( var k in flatSiteinfo ) {
			var pathes = k.split(/\./);
			var leaf = pathes.pop();
			var hash = pathes.reduce( function(stash, name) {
				return (stash[name] || (stash[name] = {}));
			}, siteinfo);
			hash[leaf] = flatSiteinfo[k];
		};
		return siteinfo;
	},
	_load_siteinfo: function () {
		if ( this.siteinfos ) {
			return succeed(this.siteinfos)
		} else {
			var self = this;
			return doXHR( this.siteinfoURL ).addCallback( function (res) {
				var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
				.createInstance(Components.interfaces.nsIJSON);

				self.siteinfos = nativeJSON.decode(res.responseText);
				self._makeSiteinfoIdHash();
				return self.siteinfos;
			} );
		}
	},
	feeds: function () {
		return this._load_siteinfo();
	},
	get: function (id) {
		return this.siteinfoIdHash[id];
	}
};
*/


var self = {
	doc: null,
	ipc: null,
	ipcEventName: "iview-ipc-from-contentWindow",
	init: function (tab) {
		this.window = tab.document.defaultView;
		this.doc = this.window.document;
		this.selectedFeedId = null;

		this.loader = null;

		this.ipc = new IPC(this.doc);

		subscribedFeeds.init();

		this.doc.addEventListener(this.ipcEventName, this._ipc_dispatcher, false );
	},
	dealloc: function () {
		subscribedFeeds.dealloc();
		this.doc.removeEventListener(this.ipcEventName, this._ipc_dispatcher, false );
	},
	_ipc_dispatcher: function (msg) {
		try {
			//log("IPC from content", msg);
				var json = eval("(" + msg.getData('json') + ")" );
				var f = self["ipc_" + json.event];
				if ( typeof f == 'function' ) {
					f.call(self, json);
				}
		} catch (e) {
			Firebug.Console.log(e);
		}
	},
	ipc_ping: function (json) {
		this.ipc.sendMessage( {
			event: 'pong',
		} );
	},
	ipc_open: function (json) {
		var u = json.uri;
		var uri = makeURI(u);

		var tab = Application.activeWindow.open(uri);
	},
	ipc_broker_stop: function (json) {
		this.loader.requestBroker.dealloc();
	},
	ipc_page_load: function (json) {
		var self = this;
		var feeds = subscribedFeeds.feeds();
		self.ipc.sendMessage( {
				event: 'feeds',
				feeds: feeds
		} );
	},
	ipc_page_unload: function (json) {
		var self = this;
		this.loader.dealloc();
	},
	ipc_prefetch: function (json) {
		this.loader.prefetchRequest(json.index);
	},
	ipc_remove_feed: function (json) {
		var feed_id = json.feed_id;
		
		// loader is associated with current feed.
		this.loader = null;

		subscribedFeeds.remove(feed_id);
	},
	ipc_add_feed: function (json) {
		var siteinfo_json = json.siteinfo;

		//var siteinfo = (new jsonDecoder()).decode(siteinfo_json);
		var siteinfo = eval(siteinfo_json);
		subscribedFeeds.add(siteinfo);
	},
	ipc_siteinfo: function () {
		var self = this;
		return doXHR( siteinfoURL ).addCallback( function (res) {
			var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
			.createInstance(Components.interfaces.nsIJSON);

			var siteinfos = nativeJSON.decode(res.responseText);

			self.ipc.sendMessage( {
				event: 'siteinfo',
				siteinfos: siteinfos
			} );
		} );
	},
	ipc_feed_select: function (json) {
		var id = json.id;
		this.selectedFeedId = id;
		var info = subscribedFeeds.get(id);

		if ( this.loader ) {
			this.loader.dealloc();
		}

		this.loader = new IviewLoader(info, this.doc, this);
	},
	ipc_share: function (json) {
		var img = json.image;
		
		var env = Cc['@brasil.to/tombloo-service;1'].getService().wrappedJSObject;
		var title = img.caption || img.permalink;
		var ps = {
			type: 		'photo',
			page:		title,
			pageUrl:	img.permalink,
			item:		title,
			itemUrl:    img.src()
		};
			
		var posters = env.models.getDefaults(ps);
		
		var self = this;
		env.Tombloo.Service.post(ps, posters).addCallback( function () {
		  self.ipc.sendMessage( {
			  event: 'sharingComplete',
			  img: img,
		  } );
		} );
	},
	ipc_piclens: function (json) {

		if ( this.loader.images.length <= 0 ) {
			return;
		}

		var items = this.loader.images.map( function(photo) {
		  var imegeUri = photo.src();
		  return ('<item>' +
		      '<title>' + photo.caption + '</title>' +
		      '<link>' + photo.permalink + '</link>' + 
		      '<media:thumbnail url="' + imegeUri + '" />' +
		      '<media:content url="' + imegeUri + '" />' +
		    '</item>'
		  );
		} );
		
		var ds = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties);
		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);

		var tmp = ds.get('TmpD', Ci.nsILocalFile);
		file.initWithPath( tmp.path );
		file.append( 'piclens.rss' );

		var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
		                   .createInstance(Components.interfaces.nsIConverterOutputStream);

		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
		fos.init(file, 0x04 | 0x08 | 0x20, 0664, 0); // write, create, truncate

		os.init(fos, 'utf-8', 0, 0x0000);
		os.writeString('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		  '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss"><channel>' +
		    items.join('') +
		   '</channel></rss>');
		os.close();

		var path = ios.newFileURI(file);


		if ( 1 ) {
			var uri = path.asciiSpec;
			this.window.location =
			'javascript:piclens = new PicLensContext();piclens.launch("' + uri + '", "", "")';
		} else {
			Cc["@cooliris.com/piclens/manager;1"]
				.getService(Ci.IPicLensManager).launchFromToolbar();
			if ( 0 ) {
				this.ipc.sendMessage( {
					event: 'piclens_rss',
					uri: path.asciiSpec
				} );
			}
		}

	},
	// IviewLoader listeners
	onRequest: function () {
		this.ipc.sendMessage( {
			event: 'page_request',
		} );
	},
	onEndOfStream: function (loader) {
		this.ipc.sendMessage( {
			event: 'eos',
		} );
	},
	onPageLoad: function (loader) {
		// skip messages from older loaders.
		if ( this.loader != loader )
			return;

		this.ipc.sendMessage( {
			event: 'page_load',
		} );
	},
	onImageError: function (img, ev, loader) {
		// skip messages from older loaders.
		if ( this.loader != loader )
			return;
		
		this.ipc.sendMessage( {
			event: 'image_error',
			img: img,
			node: ev.target,
		} );
	},
	onImageLoad: function (img, ev, loader) {
		// skip messages from older loaders.
		if ( this.loader != loader )
			return;
		
		// make loader continue to prefetch.
		this.loader.getAt(-1);

		this.ipc.sendMessage( {
			event: 'image_load',
			img: img,
			node: ev.target,
			height: ev.target.height,
			width : ev.target.width
		} );
	}
};

return self;
} )();

