(function() {
  'use strict';

  // simple set of utils to share
  angular
    .module('openshiftConsole')
    .factory('keyValueEditorUtils', [
      function() {

        var noop = function() {};

        // simple reduce fn
        var reduce = function(arr, fn, memo) {
          var length = (arr && arr.length) || 0;
          for(var i = 0; i < length; i++) {
            memo = fn(memo, arr[i], i, arr);
          }
          return memo;
        };

        var each = function(arr, fn) {
          var length = (arr && arr.length) || 0;
          for(var i = 0; i < length; i++) {
            fn(arr[i], i, arr);
          }
        };

        var map = function(arr, fn) {
          var length = (arr && arr.length) || 0;
          var list = [];
          for(var i = 0; i < length; i++) {
            list.push(fn(arr[i], i, arr));
          }
          return list;
        };

        // expects a flat array, removes empty arrays.
        // is used to eliminate extra empty pairs generated by user
        var compact = function(list) {
            return reduce(
                    list,
                    function(memo, next) {
                      if(next) {
                        memo.push(next);
                      }
                      return memo;
                    },
                    []);
        };

        var contains = function(list, item) {
          return list.indexOf(item) !== -1;
        };

        var last = function(entries) {
          return entries && entries[entries.length - 1];
        };
        var first = function(entries) {
          return entries && entries[0];
        };
        // this is a minimal get w/o deep paths
        var get = function(obj, prop) {
          return obj && obj[prop];
        };

        // these keys are for kve and, if this function is used, will be removed.
        var toClean = [
          'valueAlt',
          'isReadOnly',
          'isReadonlyKey',
          'cannotDelete',
          'keyValidator',
          'valueValidator',
          'keyValidatorError',
          'valueValidatorError',
          'keyIcon',
          'keyIconTooltip',
          'valueIcon',
          'valueIconTooltip',
          'keyValidatorErrorTooltip',
          'keyValidatorErrorTooltipIcon',
          'valueValidatorErrorTooltip',
          'valueValidatorErrorTooltipIcon'
        ];
        var cleanEntry = function(entry) {
          each(toClean, function(key) {
            delete entry[key];
          });
          return entry;
        };

        var cleanEntries = function(entries) {
          return map(entries, cleanEntry);
        };

        // cleans each entry of kve known keys and
        // drops any entry that has neither a key nor a value
        // NOTE: if the input validator fails to pass, then an
        // entry will not have a value and will be excluded. This
        // is not the fault of this function.
        var compactEntries = function(entries) {
          return compact(
                  map(
                    entries,
                    function(entry) {
                      entry = cleanEntry(entry);
                      return entry.name || entry.value ? entry : undefined;
                    }));
        };

        // returns an object of key:value pairs, last one in will win:
        // {
        //  foo: 'bar',
        //  baz: 'bam'
        // }
        var mapEntries = function(entries) {
          return reduce(
                  compactEntries(entries),
                  function(result, next) {
                    result[next.name] = next.value;
                    return result;
                  }, {});
        };

        return {
          noop: noop,
          each: each,
          reduce: reduce,
          compact: compact,
          contains: contains,
          first: first,
          last: last,
          get: get,
          cleanEntry: cleanEntry,
          cleanEntries: cleanEntries,
          compactEntries: compactEntries,
          mapEntries: mapEntries
        };
      }
    ]);
})();
