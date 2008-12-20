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
	this.disabled = false;
	this.observer = observer;

	this.queues = [];

	var self = this;
	this.brokertimer = window.setInterval( function () {
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
				
				var req = XMLHttpRequest.get(u, function () {
					try {
						f.apply(observer, [req]);
					} catch(e) {
						log(e);
					}
				} );
			}
		}
	}, 1500 );
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

var iviewLoader = function (siteinfo, doc, eventListener) {
	this.init();

	this.siteinfo = siteinfo;
	this.doc = doc;

	this.requestopts = {
		//charset: 'utf-8'
	};
	this.requestBroker = new RequestBroker(this);

	this.requestNextPage();
	this.eventListener = eventListener;
	return this;
}
iviewLoader.prototype.init = function () {
	this.currentPage = null;
	this.lastPageURI = null;
	this.lastPageDoc = null;

	this.PREFETCHSIZE = 20;
	this.images = [];

	this.requestingNextPage = false;
	this.largestRequestedImageIndex = -1;
}
iviewLoader.prototype.dealloc = function () {
	this.requestBroker.dealloc();
	this.PREFETCHSIZE = -0x7ffffffff;
}

iviewLoader.prototype.shouldPrefetch = function () {
	var b = ( this.images.length - this.largestRequestedImageIndex <= this.PREFETCHSIZE ) ;
	return b;
}
iviewLoader.prototype.getAt = function (n) {
	if ( n < 0 ) {
		n = this.largestRequestedImageIndex;
	}
	if ( n > this.largestRequestedImageIndex ) {
		this.largestRequestedImageIndex = n;
	}
	if ( this.shouldPrefetch() ) {
		if ( !this.requestingNextPage ) {
			this.requestNextPage();
		}
	}

	return this.images[n];
}
iviewLoader.prototype.requestNextPage = function () {
	if ( this.currentPage ) {
		if ( !this.siteinfo.nextLink ) {
			return;
		}
		var link = $X(this.siteinfo.nextLink, this.lastPageDoc).shift();
		var nextLink = valueOfNode(link);

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
		//log("new nextPage", nextPage);
		self.onPageLoad.apply(self, arguments);
	} );

//	var obs = this.eventListener;
//	obs && obs.onRequest && obs.onRequest.apply(obs);

}
iviewLoader.prototype.onSubrequestLoad = function (res, siteinfo, depth) {
	log ("onSubRequestLoad", res, res.channel, res.channel.URI.asciiSpec);
	var doc = createHTMLDocumentByString(this.doc, res.responseText, res.channel.contentCharset);
//	var paragraphes = $X( siteinfo.paragraph, doc );
//	log ("onSubRequest paragraphes", paragraphes);

	var base = res.channel.URI.asciiSpec;
	this.parseResponse(doc, siteinfo, base, {
		permalink: base,
		depth: depth
	});
}
iviewLoader.prototype.onPageLoad = function (res) {
	var siteinfo = this.siteinfo;

	var doc = this.lastPageDoc = createHTMLDocumentByString(this.doc, res.responseText, res.channel.contentCharset);

	var base = this.lastPageURI;
	this.parseResponse(doc, siteinfo, base);
}
iviewLoader.prototype.parseResponse = function (doc, siteinfo, baseURI, hashTemplate) {
	hashTemplate = hashTemplate || {};

	var paragraphes = $X( siteinfo.paragraph, doc );

	//log("paragraphes", paragraphes.length, siteinfo.paragraph, siteinfo, paragraphes);


	var self = this;
	var images = paragraphes.map ( function (paragraph, index) {
		var img;
		if ( siteinfo.subRequest && siteinfo.subRequest.paragraph ) {
			img = self.parseParagraph(paragraph, siteinfo, baseURI);

			var subpage = img.permalink;
			var requestopts = self.requestBroker.requestopts;
			var depth = (hashTemplate ? (hashTemplate.depth || 0) : 0 );
			depth += 1;
			var d = self.requestBroker.add(subpage, requestopts, depth, function(res) {
				self.onSubrequestLoad.call(self, res, siteinfo.subRequest, depth);
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
			} else {
				img = self.parseParagraph(paragraph, siteinfo, baseURI);
				img = update(img, hashTemplate);
				self.addToImageList(img);
			}
		}
		return img;
	} );

	var obs = this.eventListener;
	obs && obs.onPageLoad && obs.onPageLoad.apply(obs);
	return images;
}
iviewLoader.prototype.addToImageList = function (img) {
	if ( img.imageSource && img.permalink ) {
		var i = new Image();
		var self = this;
		i.onload = function (ev) {
			i.removeEventListener('load', img._load_listener, false);
			var obs = self.eventListener;
			obs && obs.onImageLoad && obs.onImageLoad.apply(obs, [img, ev]);
		} ;
		i.src = img.src();
		img.index = this.images.length;
		this.images.push(img);
	}
}
iviewLoader.prototype.parseParagraph = function (paragraph, siteinfo, baseURI) {
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
			var node = rs.shift();
			if ( k == 'caption' ) {
				v =  node.textContent.replace(/(^\s*)|(\s*$)/g, '');
			} else {
				if ( node == null ) {
					continue;
				} else {
					if ( node ) {
						v = valueOfNode(node);
						v = abs(baseURI, v);
					} else {
						log("node is null", paragraph, node, k);
					}
				}
			}
		}

		image[k] = v;
	}
	return image;
}

var iviewSiteinfo = {
	siteinfos: null,
	siteinfoURL: 'http://wedata.net/databases/iview/items.json',
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
	feeds: function () {
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
	get: function (id) {
		return this.siteinfoIdHash[id];
	}
};


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

		iviewSiteinfo.init();

		this.doc.addEventListener(this.ipcEventName, this._ipc_dispatcher, false );
	},
	dealloc: function () {
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
	ipc_broker_stop: function (json) {
		this.loader.requestBroker.dealloc();
	},
	ipc_page_load: function (json) {
		var self = this;
		iviewSiteinfo.feeds().addCallback( function (res) {
			self.ipc.sendMessage( {
				event: 'feeds',
				feeds: res
			} );
		} );
	},
	ipc_page_unload: function (json) {
		var self = this;
		this.loader.dealloc();
	},
	ipc_prefetch: function (json) {
		this.loader.getAt(json.index);
	},
	ipc_feed_select: function (json) {
		var id = json.id;
		this.selectedFeedId = id;
		var info = iviewSiteinfo.get(id);

		if ( this.loader ) {
			this.loader.dealloc();
		}
		this.loader = new iviewLoader(info, this.doc, this);
	},
	ipc_share: function (json) {
		var i = json.image;

		
		var env = Cc['@brasil.to/tombloo-service;1'].getService().wrappedJSObject;
		var title = i.caption || i.permalink;
		var ps = {
			type: 		'photo',
			page:		title,
			pageUrl:	i.permalink,
			item:		title,
			itemUrl:    i.imageSource
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

		var ios = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
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
	// iviewLoader listeners
	onRequest: function () {
		this.ipc.sendMessage( {
			event: 'page_request',
		} );
	},
	onPageLoad: function () {
		this.ipc.sendMessage( {
			event: 'page_load',
		} );
	},
	onImageLoad: function (img, ev) {
		// make loader continue to prefetch.
		this.loader.getAt(-1);

		this.ipc.sendMessage( {
			event: 'image_load',
			img: img,
			feed_id: this.selectedFeedId,
			node: ev.target,
			height: ev.target.height,
			width : ev.target.width
		} );
	}
};

return self;
} )();

