var log = function () {
	Firebug.Console.log(arguments);
}

// $X
// based on: http://lowreal.net/blog/2007/11/17/1
//
// $X(exp);
// $X(exp, context);
// $X(exp, type);
// $X(exp, {context: context,
//          type: type,
//          namespace: {h:"http://www.w3.org/1999/xhtml"}});
function $X (exp, context) {
	var type, namespace={};
	
//FIXME
	exp = exp.replace(/\bx:/g, 'descendant-or-self::');
//

	if(typeof context == "function"){
		type = context;
		context = null;
	}else if(typeof context != "undefined" && !context['nodeType']){
		type = context['type'];
		namespace = context['namespace'] || context['ns'];
		context = context['context'];
	}

	if (!context) context = document;
	var exp = (context.ownerDocument || context).createExpression(exp, function (prefix) {
		return namespace[prefix] ||
		       document.createNSResolver((context.ownerDocument == null ? context : context.ownerDocument)
		               .documentElement).lookupNamespaceURI(prefix) ||
		       document.documentElement.namespaceURI;
	});

	switch (type) {
		case String:
			return exp.evaluate(
				context,
				XPathResult.STRING_TYPE,
				null
			).stringValue;
		case Number:
			return exp.evaluate(
				context,
				XPathResult.NUMBER_TYPE,
				null
			).numberValue;
		case Boolean:
			return exp.evaluate(
				context,
				XPathResult.BOOLEAN_TYPE,
				null
			).booleanValue;
		case Array:
			var result = exp.evaluate(
				context,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
				null
			);
			var ret = [];
			for (var i = 0, len = result.snapshotLength; i < len; ret.push(result.snapshotItem(i++)));
			return ret;
		case undefined:
			var result = exp.evaluate(context, XPathResult.ANY_TYPE, null);
			switch (result.resultType) {
				case XPathResult.STRING_TYPE : return result.stringValue;
				case XPathResult.NUMBER_TYPE : return result.numberValue;
				case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
				case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
					// not ensure the order.
					var ret = [];
					var i = null;
					while (i = result.iterateNext()) {
						ret.push(i);
					}
					return ret;
				}
			}
			return null;
		default:
			throw(TypeError("$X: specified type is not valid type."));
	}
}

function createDocumentFragmentByString(doc, str) {
    var range = doc.createRange()

	var body = (doc.documentElement);
    range.setStartAfter(body);
    return range.createContextualFragment(str)
}
function createHTMLDocumentByString(doc, str, charset) {
		if ( charset && charset != 'x-user-defined' ) {
		} else {
			var  m;
			if ( m = str.match( /<meta\b[^>]+?http-equiv=["']?content-type["']?[^>]+?>/i ) ) {
				var meta = m[0];
				m = meta.match( /content=(?:(?:'(.+?)')|(?:"(.+?)")|(\S+))/i );
				var content = m[1] || m[2] || m[3];
				if ( m = content.match(/charset=(\S+)/i ) ) {
					var charset = m[1];
					
					charset = charset.replace(/(x-?)euc_jp/i, "euc-jp");
					charset = charset.replace(/shift-jis/i, "SHIFT_JIS");
					charset = charset.replace(/Windows-31j/, "SHIFT_JIS");
				} else {
				}
			} else if ( m = str.match( /<meta\b[^>]+?http-equiv=["']?charset["']?[^>]+?>/i ) ) {
				var meta = m[0];
				m = meta.match( /content=(?:(?:'(.+?)')|(?:"(.+?)")|(\S+))/i );
				if ( m ) {
					charset = m[1] || m[2] || m[3];
				} else {
				}
			} else {
			}
		}

		if ( charset ) {
			charset = charset.replace(/(x-?)euc_jp/i, "euc-jp");
			charset = charset.replace(/shift-jis/i, "SHIFT_JIS");
			charset = charset.replace(/Windows-31j/, "SHIFT_JIS");
			str = convertToUnicode(str, charset);
		}

    var html = str.replace(/<!DOCTYPE.*?>/, '').replace(/<html.*?>/, '').replace(/<\/html>.*/, '')
    var htmlDoc  = doc.implementation.createDocument(null, 'html', null)
    var fragment = createDocumentFragmentByString(doc, html)
    try {
        fragment = htmlDoc.adoptNode(fragment)
    } catch(e) {
        fragment = htmlDoc.importNode(fragment, true)
    }
    htmlDoc.documentElement.appendChild(fragment)
   return htmlDoc
}



function abs(base, rel) {
	var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
	var nsiuri = ios.newURI(base, null, null);
	return nsiuri.resolve(rel);
}


function valueOfNode (node) {
	if (node) {
		var doc = node.ownerDocument;
			if ( node.nodeType == node.ELEMENT_NODE ) {
				if ( node.tagName.match( /^(a|link)$/i ) ) {
					var u = node.getAttribute('href');
					return u;
				} else if ( node.tagName.match( /img/i ) ) {
					var u = node.getAttribute('src');
					return u;
				} else {
					return node.textContent.replace(/(^\s*)|(\s*$)/g, '');
				}
			} else if ( node.nodeType == node.ATTRIBUTE_NODE ) {
				var u = node.nodeValue;
				return u;
			} else if (node.nodeType == node.TEXT_NODE ) {
				return node.nodeValue;
			} else {
				return node;
			}
	} else {
		return "";
	}
}


function convertToUnicode(s, charset){
	var converter = Components
		.classes['@mozilla.org/intl/scriptableunicodeconverter']
		.getService(Components.interfaces.nsIScriptableUnicodeConverter);
	converter.charset = charset;

	return converter.ConvertToUnicode(s);
}

