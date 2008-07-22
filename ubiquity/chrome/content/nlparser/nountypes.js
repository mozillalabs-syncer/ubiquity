function NounType( name, expectedWords ) {
  this._init( name, expectedWords );
}
NounType.prototype = {
  _init: function( name, expectedWords ) {
    this._name = name;
    this._expectedWords = expectedWords; // an array
  },

  match: function( fragment ) {
    var suggs = this.suggest( fragment );
    // klugy!
    if ( suggs.length > 0 ) {
      return true;
    }
    return false;
  },

  suggest: function( fragment ) {
    // returns (ordered) array of suggestions
    if (!fragment) {
      return [];
    }
    var suggestions = [];
    for ( var x in this._expectedWords ) {
      word = this._expectedWords[x];
      if ( word.indexOf( fragment ) > -1 ) {
	suggestions.push( word );
	// TODO sort these in order of goodness
	// todo if fragment is multiple words, search for each of them
	// separately within the expected word.
      }
    }
    return suggestions;
  }
};

var arbText = {
  // a singleton object which can be used in place of a NounType.
 _name: "text",
 match: function( fragment ) {
    return true;
  },
 suggest: function( fragment ) {
    return [ fragment ];
  }
};

var DateNounType = {
  match: function( fragment ) {
    return (this.suggest(fragment).length > 0 );
  },
  suggest: function( fragment )  {
    if (!fragment) {
      return [];
    }
    var date = Date.parse( fragment );
    if (!date) {
      return [];
    }
    return [ "parsed date: " + date.toString() ];
  }
};

function isAddress( query, callback ) {
  var url = "http://local.yahooapis.com/MapsService/V1/geocode";
  var params = paramsToString({
    location: query,
    appid: "YD-9G7bey8_JXxQP6rxl.fBFGgCdNjoDMACQA--"
  });


  jQuery.ajax({
    url: url+params,
    dataType: "xml",
    error: function() {
      callback( false );
    },
    success:function(data) {
      var results = jQuery(data).find("Result");
      var allText = jQuery.makeArray(
                      jQuery(data)
                        .find(":contains()")
                        .map( function(){ return jQuery(this).text().toLowerCase() } )
                      );

      // TODO: Handle non-abbriviated States. Like Illinois instead of IL.

      if( results.length == 0 ){
        callback( false );
        return;
      }

      function existsMatch( text ){
        var joinedText = allText.join(" ");
        return joinedText.indexOf( text.toLowerCase() ) != -1;
      }

      missCount = 0;

      var queryWords = query.match(/\w+/g);
      for( var i=0; i < queryWords.length; i++ ){
        if( existsMatch( queryWords[i] ) == false ) {
          missCount += 1;
          //displayMessage( queryWords[i] );
        }
      }

      var missRatio = missCount / queryWords.length;
      //displayMessage( missRatio );

      if( missRatio < .5 )
        callback( true );
      else
        callback( false );
    }
  });
}

// TODO this is a really crappy implementation for async address detection
var AddressNounType = {
  knownAddresses: [],
  maybeAddress: null,
  callback: function( isAnAddress ) {
    if (isAnAddress) {
      AddressNounType.knownAddresses.push( AddressNounType.maybeAddress );
    }
    AddressNounType.maybeAddress = null;
  },
  match: function( fragment ) {
    for( x in knownAddresses) {
      if (knownAddresses[x] == fragment) {
	return true;
      }
    }
    AddressNounType.maybeAddress = fragment;
    isAddress( fragment, AddressNounType.callback );
    return false;
  },
  suggest: function( fragment ) {
    isAddress( fragment, AddressNounType.callback );
    for( x in knownAddresses) {
      if (knownAddresses[x] == fragment) {
	return [ fragment ];
      }
    }
    AddressNounType.maybeAddress = fragment;
    isAddress( fragment, AddressNounType.callback );
    return [];
  }
};

// TODO replace this with ???
var MathNounType = {
  match: function( fragment ) {

  },
  suggest: function( fragment ) {

  }
};

var Languages = {
  'ARABIC' : 'ar',
  'CHINESE' : 'zh',
  'CHINESE_TRADITIONAL' : 'zh-TW',
  'DANISH' : 'da',
  'DUTCH': 'nl',
  'ENGLISH' : 'en',
  'FINNISH' : 'fi',
  'FRENCH' : 'fr',
  'GERMAN' : 'de',
  'GREEK' : 'el',
  'HINDI' : 'hi',
  'ITALIAN' : 'it',
  'JAPANESE' : 'ja',
  'KOREAN' : 'ko',
  'NORWEGIAN' : 'no',
  'POLISH' : 'pl',
  'PORTUGUESE' : 'pt-PT',
  'ROMANIAN' : 'ro',
  'RUSSIAN' : 'ru',
  'SPANISH' : 'es',
  'SWEDISH' : 'sv'
};
var languageNounType = new NounType( "language",
				     [ "ar", "zh", "zh-TW", "da",
				     "nl", "en", "fi", "fr",
				       "de", "el", "hi", "it", "ja", "ko", "no", "pl", "pt-PT",
				       "ro", "ru", "es", "sv"] );

// TODO Replace this with gmail contact list or something
var personNounType = new NounType( "person", ["atul@mozilla.com",
					      "aza@mozilla.com",  "thunder@mozilla.com",
					      "chris@mozilla.com", "myk@mozilla.com" ] );

const NOUN_LIST = [AddressNounType,
		                 languageNounType,
				 personNounType,
				 MathNounType,
				 DateNounType,
				 arbText];