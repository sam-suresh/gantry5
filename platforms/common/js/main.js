require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
"use strict";

var ready        = require('elements/domready'),
    map          = require('prime/map')(),
    merge        = require('mout/object/merge'),
    forEach      = require('mout/array/forEach'),
    trim         = require('mout/string/trim'),
    $            = require('../utils/elements.utils'),
    decouple     = require('../utils/decouple'),
    asyncForEach = require('../utils/async-foreach');

var Map         = map,
    Assignments = {
        toggleSection: function(e, element, index, array) {
            if (e.type.match(/^touch/)) { e.preventDefault(); }
            if (element.parent('[data-g-global-filter]')) { return Assignments.globalToggleSection(e, element); }
            if (element.matches('label')) { return Assignments.treatLabel(e, element); }

            var card    = element.parent('.card'),
                toggles = Map.get(card),
                save    = $('[data-save]'),
                mode    = element.data('g-assignments-check') == null ? 0 : 1;

            if (!toggles || !toggles.inputs) {
                var inputs = card.search('.enabler input[type=hidden]');

                if (!toggles) { toggles = Map.set(card, { inputs: inputs }).get(card); }
                if (!toggles.inputs) { toggles = Map.set(card, merge(Map.get(card), { inputs: inputs })).get(card); }
            }

            // if necessary we should move to asyncForEach for an asynchronous loop, else forEach
            asyncForEach(toggles.inputs, function(item) {
                item = $(item);

                if (item.parent('label').compute('display') == 'none') { return; }

                item.value(mode).emit('change');
                $('body').emit('change', { target: item });
            }, function() {
                if (typeof index !== 'undefined' && typeof array !== 'undefined' && (index + 1 == array.length)) {
                    save.disabled(false);
                }
            });
        },

        filterSection: function(e, element, value, global) {
            if (element.parent('[data-g-global-filter]')) { return Assignments.globalFilterSection(e, element); }

            var card        = element.parent('.card'),
                onlyEnabled = $('[data-assignments-enabledonly]'),
                items       = Map.get(card) || Map.set(card, { labels: card.search('label .settings-param-title') }).get(card);

            value = value || element.value();

            if (!items || !items.labels) {
                var labels = card.search('label .settings-param-title');

                if (!items) { items = Map.set(card, { labels: labels }).get(card); }
                if (!items.labels) { items = Map.set(card, merge(Map.get(card), { labels: labels })).get(card); }
            }

            items = $(items.labels);

            if (!value && !onlyEnabled.checked()) {
                card.style('display', 'inline-block');
                return items ? items.search('!> label').style('display', 'block') : items;
            }

            var count = 0, off = 0, on = 0, text, match;

            if (!items) {
                element.parent('.card').style('display', onlyEnabled.checked() || value ? 'none' : 'inline-block');
            }

            asyncForEach(items, function(item, i) {
                item = $(item);
                text = trim(item.text());
                match = text.match(new RegExp("^" + value + '|\\s' + value, 'gi'));

                if (onlyEnabled.checked()) {
                    match = Number(!!match) & Number(item.parent('label').find('.enabler input[type="hidden"]').value());
                }

                if (match) {
                    var group = item.parent('[data-g-assignments-parent]');
                    if (group && (group = group.data('g-assignments-parent'))) {
                        var parentGroup = item.parent('.card').find('[data-g-assignments-group="' + group + '"]');
                        if (parentGroup) { parentGroup.style('display', 'block'); }
                    }

                    item.parent('label').style('display', 'block');
                    on++;
                } else {
                    item.parent('label').style('display', 'none');
                    off++;
                }

                count++;
                if (count == items.length && global) {
                    card.style('display', !on ? 'none' : 'inline-block');
                }
            });
        },

        filterEnabledOnly: function(e, element) {
            var global = $('[data-g-global-filter] input[type="text"]');
            Assignments.globalFilterSection(e, global, element);
        },

        treatLabel: function(event, element) {
            if (event && event.stopPropagation && event.preventDefault) {
                event.stopPropagation();
                event.preventDefault();
            }

            if ($(event.target).matches('.knob, .toggle')) { return; }
            var input = element.find('input[type="hidden"]:not([disabled])');
            if (!input) { return; }

            var value = input.value();
            value = !!+value;
            input.value(Number(!value)).emit('change');
            $('body').emit('change', { target: input });

            return false;
        },

        globalToggleSection: function(e, element) {
            var mode   = element.data('g-assignments-check') == null ? '[data-g-assignments-uncheck]' : '[data-g-assignments-check]',
                save   = $('[data-save]'),
                search = $('#assignments .card ' + mode);

            if (!search) { return; }

            save.disabled(true);
            // if necessary we should move to asyncForEach for an asynchronous loop
            asyncForEach(search, function(item, index, array) {
                Assignments.toggleSection(e, $(item), index, array);
            });
        },

        globalFilterSection: function(e, element) {
            var value       = element.value(),
                onlyEnabled = $('[data-assignments-enabledonly]'),
                search      = $('#assignments .card .search input[type="text"]');

            if (!search && !onlyEnabled.checked()) { return; }

            asyncForEach(search, function(item) {
                Assignments.filterSection(e, $(item), value, 'global');
            });
        },

        // chrome workaround for overflow and columns
        chromeFix: function() {
            if (!Assignments.isChrome()) { return; }
            var panels = $('#assignments .settings-param-wrapper'), height, maxHeight;
            if (!panels) { return; }

            panels.forEach(function(panel){
                panel = $(panel);
                maxHeight = parseInt(panel.compute('max-height'), 10);
                height = panel[0].getBoundingClientRect().height;
                panel.style({overflow: height >= maxHeight ? 'auto' : 'visible'});

                if (height >= maxHeight) {
                    var alt = 100;
                    decouple(panel, 'scroll', function() {
                        alt = alt == 100 ? 100.01 : 100;
                        panel.parent('.card').style('width', alt + '%');
                    });
                }
            });
        },

        isChrome: function() {
            return navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
        }
    };

ready(function() {
    var body = $('body');

    body.delegate('input', '#assignments .search input[type="text"]', Assignments.filterSection);
    body.delegate('click', '#assignments .card label, #assignments [data-g-assignments-check], #assignments [data-g-assignments-uncheck]', Assignments.toggleSection);
    body.delegate('touchend', '#assignments .card label, #assignments [data-g-assignments-check], #assignments [data-g-assignments-uncheck]', Assignments.toggleSection);
    body.delegate('change', '[data-assignments-enabledonly]', Assignments.filterEnabledOnly);

    // chrome workaround for overflow and columns
    //if (Assignments.isChrome()) Assignments.chromeFix();
});

module.exports = Assignments;

},{"../utils/async-foreach":58,"../utils/decouple":59,"../utils/elements.utils":60,"elements/domready":101,"mout/array/forEach":143,"mout/object/merge":203,"mout/string/trim":237,"prime/map":268}],3:[function(require,module,exports){
"use strict";
var $             = require('elements'),
    zen           = require('elements/zen'),
    ready         = require('elements/domready'),
    ui            = require('../ui'),
    interpolate   = require('mout/string/interpolate'),
    modal         = ui.modal,
    trim          = require('mout/string/trim'),

    parseAjaxURI  = require('../utils/get-ajax-url').parse,
    getAjaxURL    = require('../utils/get-ajax-url').global,
    getAjaxSuffix = require('../utils/get-ajax-suffix');

ready(function() {
    // Changelog links
    $('body').delegate('click', '[data-changelog]', function(event, element) {
        event.preventDefault();

        modal.open({
            content: 'Loading',
            method: 'post',
            className: 'g5-dialog-theme-default g5-modal-changelog',
            data: { version: element.data('changelog') },
            remote: parseAjaxURI(getAjaxURL('changelog') + getAjaxSuffix()),
            remoteLoaded: function(response, content) {
                if (!response.body.success) { return; }

                var wrapper  = content.elements.content,
                    sections = wrapper.search('#g-changelog > ol > li > a');

                sections.forEach(function(section, i) {
                    section = $(section);
                    var href      = section.href(),
                        re        = new RegExp('#(common|' + GANTRY_PLATFORM + ')$', "gi"),
                        collapsed = !href.match(re),
                        status    = 'chevron-' + (!collapsed ? 'up' : 'down');

                    if (!trim(section.text())) {
                        // no platforms
                        return;
                    }

                    // if it's not common but the current platform, move it after common
                    if (i && !collapsed) {
                        section.parent('li').after(section.parent('ol').find('> li'));
                    }

                    zen('i[class="fa g-changelog-toggle fa-fw fa-' + status + '"]').bottom(section);

                    if (collapsed) {
                        section.nextSibling().style({
                            overflow: 'hidden',
                            height: 0
                        });
                    }

                    section.on('click', function(e) {
                        e.preventDefault();
                        var icon      = section.find('i[class*="fa-chevron-"]'),
                            collapsed = icon.hasClass('fa-chevron-down');

                        if (collapsed) {
                            icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
                            section.nextSibling().slideDown();
                        } else {
                            icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
                            section.nextSibling().slideUp();
                        }
                    });
                });
            }
        });
    });
});

},{"../ui":49,"../utils/get-ajax-suffix":64,"../utils/get-ajax-url":65,"elements":103,"elements/domready":101,"elements/zen":106,"mout/string/interpolate":226,"mout/string/trim":237}],4:[function(require,module,exports){
"use strict";

var $             = require('elements'),
    ready         = require('elements/domready'),
    request       = require('agent'),

    modal         = require('../ui').modal,
    guid          = require('mout/random/guid'),
    trim          = require('mout/string/trim'),

    getAjaxSuffix = require('../utils/get-ajax-suffix'),
    parseAjaxURI  = require('../utils/get-ajax-url').parse,
    getAjaxURL    = require('../utils/get-ajax-url').global,

    History       = require('../utils/history'),
    getParam      = require('mout/queryString/getParam'),
    setParam      = require('mout/queryString/setParam');


var refreshWordpressLinks = function (title, value) {
    if (GANTRY_PLATFORM == 'wordpress') {
        // refresh URIs with new configuration name
        var replace = title.replace(/[^a-z\d_-\s]/i, '_').toLowerCase(),
            find = $('[href*="/' + value + '/"]'),
            currentURI = History.getPageUrl(),
            currentView = getParam(currentURI, 'view');

        if (find) {
            find.forEach(function(lnk){
                lnk = $(lnk);
                var href = lnk.href().replace('/' + value + '/', '/' + replace + '/');
                lnk.href(href);
            });
        }

        currentView = currentView.replace('/' + value + '/', '/' + replace + '/');
        currentURI = setParam(currentURI, 'view', currentView);
        History.replaceState({ uuid: guid(), doNothing: true }, window.document.title, currentURI);
    }
}

ready(function() {
    var body = $('body');

    var selectized, select, editable, href;
    body.delegate('keydown', '.config-select-wrap [data-title-edit]', function(event, element) {
        var key = (event.which ? event.which : event.keyCode);
        if (key == 32 || key == 13) { // ARIA support: Space / Enter toggle
            event.preventDefault();
            body.emit('mousedown', event);
        }
    });

    body.delegate('mousedown', '.config-select-wrap [data-title-edit]', function(event, element) {
        selectized = element.siblings('.g-selectize-control');
        select = element.siblings('select');
        editable = element.siblings('[data-title-editable]');

        if (!editable.gConfEditAttached) {
            editable.gConfEditAttached = true;
            editable.on('title-edit-end', function(title, original, canceled) {
                title = trim(title);
                if (canceled || title == original) {
                    selectized.style('display', 'inline-block');
                    editable.style('display', 'none').attribute('contenteditable', null);

                    return;
                }

                element.addClass('disabled');
                element.removeClass('fa-pencil').addClass('fa-spin-fast fa-spinner');
                href = editable.data('g-config-href');

                request('post', parseAjaxURI(href + getAjaxSuffix()), { title: title }, function(error, response) {
                    if (!response.body.success) {
                        modal.open({
                            content: response.body.html || response.body,
                            afterOpen: function(container) {
                                if (!response.body.html) { container.style({ width: '90%' }); }
                            }
                        });

                        editable.data('title-editable', original).text(original);
                    } else {
                        var selectize = select.selectizeInstance,
                            value = select.value(),
                            data = selectize.Options[value];

                        data[selectize.options.labelField] = title;
                        selectize.updateOption(value, data);

                        selectized.style('display', 'inline-block');
                        editable.style('display', 'none')
                    }

                    // fix Wordpress non unique IDs by refreshing all hrefs
                    refreshWordpressLinks(title, value);

                    element.removeClass('disabled');
                    element.removeClass('fa-spin-fast fa-spinner').addClass('fa-pencil');
                });
            });
        }

        editable.style({
            width: selectized.compute('width'),
            display: 'inline-block'
        });
        selectized.style('display', 'none');
    });
});

module.exports = {};

},{"../ui":49,"../utils/get-ajax-suffix":64,"../utils/get-ajax-url":65,"../utils/history":68,"agent":71,"elements":103,"elements/domready":101,"mout/queryString/getParam":213,"mout/queryString/setParam":215,"mout/random/guid":217,"mout/string/trim":237}],5:[function(require,module,exports){
"use strict";

var $             = require('elements'),
    zen           = require('elements/zen'),
    ready         = require('elements/domready'),
    trim          = require('mout/string/trim'),
    keys          = require('mout/object/keys'),
    modal         = require('../ui').modal,
    toastr        = require('../ui').toastr,
    request       = require('agent'),
    getAjaxSuffix = require('../utils/get-ajax-suffix'),
    parseAjaxURI  = require('../utils/get-ajax-url').parse,
    getAjaxURL    = require('../utils/get-ajax-url').global,

    flags         = require('../utils/flags-state');

require('./dropdown-edit');

ready(function() {
    var body = $('body'),
        warningURL = parseAjaxURI(getAjaxURL('confirmdeletion') + getAjaxSuffix());

    // Handles Configurations Duplicate / Remove
    body.delegate('click', '#configurations [data-g-config]', function(event, element) {
        var mode = element.data('g-config'),
            href = element.data('g-config-href'),
            encode = window.btoa(href),//.substr(-20, 20), // in case the strings gets too long
            method = (element.data('g-config-method') || 'post').toLowerCase();

        if (event && event.preventDefault) { event.preventDefault(); }

        if (mode == 'delete' && !flags.get('free:to:delete:' + encode, false)) {
            // confirm before proceeding
            flags.warning({
                url: warningURL,
                callback: function(response, content) {
                    var confirm = content.find('[data-g-delete-confirm]'),
                        cancel  = content.find('[data-g-delete-cancel]');

                    if (!confirm) { return; }

                    confirm.on('click', function(e) {
                        e.preventDefault();
                        if (this.attribute('disabled')) { return false; }

                        flags.get('free:to:delete:' + encode, true);
                        $([confirm, cancel]).attribute('disabled');
                        body.emit('click', { target: element });

                        modal.close();
                    });

                    cancel.on('click', function(e) {
                        e.preventDefault();
                        if (this.attribute('disabled')) { return false; }

                        $([confirm, cancel]).attribute('disabled');
                        flags.get('free:to:delete:' + encode, false);

                        modal.close();
                    });
                }
            });

            return false;
        }

        element.hideIndicator();
        element.showIndicator();

        request(method, parseAjaxURI(href + getAjaxSuffix()), {}, function(error, response) {
            if (!response.body.success) {
                modal.open({
                    content: response.body.html || response.body,
                    afterOpen: function(container) {
                        if (!response.body.html) { container.style({ width: '90%' }); }
                    }
                });
            } else {
                var confSelector = $('#configuration-selector'),
                    currentOutline = confSelector.value(),
                    outlineDeleted = response.body.outline,
                    reload = $('[href="' + getAjaxURL('configurations') + '"]');

                // if the current outline is the one that's been deleted,
                // fallback to default
                if (outlineDeleted && currentOutline == outlineDeleted) {
                    var ids = keys(confSelector.selectizeInstance.Options);
                    if (ids.length) {
                        reload.href(reload.href().replace('style=' + outlineDeleted, 'style=' + ids.shift()));
                    }
                }

                if (!reload) { window.location = window.location; }
                else {
                    body.emit('click', {target: reload});
                }

                toastr.success(response.body.html || 'Action successfully completed.', response.body.title || '');
                if (outlineDeleted) {
                    body.outlineDeleted = outlineDeleted;
                }
            }

            element.hideIndicator();
        });

    });

    // Handles Configurations Titles Rename
    var updateTitle = function(title, original, wasCanceled) {
            this.style('text-overflow', 'ellipsis');
            if (wasCanceled || title == original) { return; }
            var element = this,
                href = element.data('g-config-href'),
                method = (element.data('g-config-method') || 'post').toLowerCase(),
                parent = element.parent();

            parent.showIndicator();
            parent.find('[data-title-edit]').addClass('disabled');

            request(method, parseAjaxURI(href + getAjaxSuffix()), { title: trim(title) }, function(error, response) {
                if (!response.body.success) {
                    modal.open({
                        content: response.body.html || response.body,
                        afterOpen: function(container) {
                            if (!response.body.html) { container.style({ width: '90%' }); }
                        }
                    });

                    element.data('title-editable', original).text(original);
                } else {
                    element.data('title', title).data('tip', title);

                    // refresh ID label and actions buttons
                    var dummy = zen('div').html(response.body.outline),
                        id = dummy.find('h4 span:last-child'),
                        actions = dummy.find('.outline-actions');

                    element.parent('.card').find('h4 span:last-child').html(id.html());
                    element.parent('.card').find('.outline-actions').html(actions.html());
                }

                parent.hideIndicator();
                parent.find('[data-title-edit]').removeClass('disabled');
            });
        },

        attachEditables = function(editables) {
            if (!editables || !editables.length) { return; }
            editables.forEach(function(editable) {
                editable = $(editable);
                editable.confWasAttached = true;
                editable.on('title-edit-start', function(){
                    editable.style('text-overflow', 'inherit');
                });
                editable.on('title-edit-end', updateTitle);
            });
        };

    body.on('statechangeAfter', function(event, element) {
        var editables = $('#configurations [data-title-editable]');
        if (!editables) { return true; }

        editables = editables.filter(function(editable) {
            return (typeof $(editable).confWasAttached) === 'undefined';
        });

        attachEditables(editables);
    });

    attachEditables($('#configurations [data-title-editable]'));
});

module.exports = {};

},{"../ui":49,"../utils/flags-state":63,"../utils/get-ajax-suffix":64,"../utils/get-ajax-url":65,"./dropdown-edit":4,"agent":71,"elements":103,"elements/domready":101,"elements/zen":106,"mout/object/keys":202,"mout/string/trim":237}],6:[function(require,module,exports){
"use strict";
var ready      = require('elements/domready'),
    $          = require('elements/attributes'),
    storage    = require('prime/map'),
    deepEquals = require('mout/lang/deepEquals'),
    is         = require('mout/lang/is'),
    isString   = require('mout/lang/isString'),
    hasOwn     = require('mout/object/has'),
    forEach    = require('mout/collection/forEach'),
    invoke     = require('mout/array/invoke'),
    History    = require('../utils/history'),
    flags      = require('../utils/flags-state');


var originals,
    collectFieldsValues = function(keys) {
        var map      = new storage(),
            defaults = $('[data-g-styles-defaults]');

        defaults = defaults ? JSON.parse(defaults.data('g-styles-defaults')) : {};

        if (keys) {
            var field;
            keys.forEach(function(key) {
                field = $('[name="' + key + '"]');
                if (field) {
                    map.set(key, field.value());
                }
            });

            return map;
        }

        var fields = $('.settings-block [name]');
        if (!fields) { return false; }

        fields.forEach(function(field) {
            field = $(field);
            var key     = field.attribute('name'),
                isInput = !hasOwn(defaults, key);

            if (field.type() == 'checkbox' && !field.value().length) { field.value('0'); }
            map.set(key, isInput ? field.value() : defaults[key]);
        }, this);

        return map;
    },
    createMapFrom       = function(data) {
        var map = new storage();

        forEach(data, function(value, key) {
            map.set(key, value);
        });

        return map;
    };

var compare = {
    single: function() {},
    whole: function() {},
    blanks: function() {},
    presets: function() {}
};

ready(function() {
    var body = $('body'), presetsCache;

    originals = collectFieldsValues();

    compare.single = function(event, element) {
        var parent      = element.parent('.settings-param') || element.parent('h4') || element.parent('.input-group'),
            target      = parent ? (parent.matches('h4') ? parent : parent.find('.settings-param-title, .g-instancepicker-title')) : null,
            isOverride  = parent ? parent.find('.settings-param-toggle') : false,
            isNewWidget = false;

        if (!parent) { return; }

        if (element.type() == 'checkbox') {
            element.value(Number(element.checked()).toString());
        }

        if (originals && originals.get(element.attribute('name')) == null) {
            originals.set(element.attribute('name'), element.value());
            isNewWidget = true;
        }

        if (!target || !originals || originals.get(element.attribute('name')) == null) { return; }
        if (originals.get(element.attribute('name')) !== element.value() || isNewWidget) {
            if (isOverride && event.forceOverride && !isOverride.checked()) { isOverride[0].click(); }
            target.showIndicator('changes-indicator font-small fa fa-circle-o fa-fw');
        } else {
            if (isOverride && event.forceOverride && isOverride.checked()) { isOverride[0].click(); }
            target.hideIndicator();
        }

        compare.blanks(event, parent.find('.settings-param-field'));
        compare.whole('force');
        compare.presets();
    };

    compare.whole = function(force) {
        var equals = deepEquals(originals, collectFieldsValues(force ? originals.keys() : null), function(a, b) {
                if (isString(a) && isString(b) && a.substr(0, 1) == '#' && b.substr(0, 1) == '#') {
                    return a.toLowerCase() == b.toLowerCase();
                } else {
                    return is(a, b);
                }
            }),
            save   = $('[data-save]');

        if (!save) { return; }

        flags.set('pending', !equals);
        save[equals ? 'hideIndicator' : 'showIndicator']('changes-indicator fa fa-circle-o fa-fw');
    };

    compare.blanks = function(event, element) {
        if (!element) { return; }
        var field = element.find('[name]'),
            reset = element.find('.g-reset-field');
        if (!field || !reset) { return true; }

        var value = field.value();
        if (!value || field.disabled()) { reset.style('display', 'none'); }
        else { reset.removeAttribute('style'); }
    };

    compare.presets = function() {
        var presets = $('[data-g-styles]'), store;
        if (!presets) { return; }

        if (!presetsCache) {
            presetsCache = new storage();
            forEach(presets, function(preset, index) {
                preset = $(preset);
                store = {
                    index: index,
                    map: createMapFrom(JSON.parse(preset.data('g-styles')))
                };
                presetsCache.set(preset, store);
            });
        }

        var fields, equals;
        presetsCache.forEach(function(data, element) {
            fields = collectFieldsValues(data.map.keys());
            equals = deepEquals(fields, data.map, function(a, b) { return a == b; });
            $($('[data-g-styles]')[data.index]).parent()[equals ? 'addClass' : 'removeClass']('g-preset-match');
        });
    };

    body.delegate('input', '.settings-block input[name][type="text"], .settings-block textarea[name]', compare.single);
    body.delegate('change', '.settings-block input[name][type="hidden"], .settings-block input[name][type="checkbox"], .settings-block select[name], .settings-block .selectized[name]', compare.single);

    body.delegate('input', '.g-urltemplate', function(event, element) {
        var previous = element.parent('.settings-param').siblings();
        if (!previous) { return; }

        previous = previous.find('[data-g-urltemplate]');

        if (previous) {
            var template = previous.data('g-urltemplate');
            previous.attribute('href', template.replace(/#ID#/g, element.value()));
        }
    });

    // fields resets
    body.delegate('mouseenter', '.settings-param-field', compare.blanks, true);
    body.delegate('click', '.g-reset-field', function(e, element) {
        var parent = element.parent('.settings-param-field'), field;
        if (!parent) { return; }

        field = parent.find('[name]');
        if (field && !field.disabled()) {
            var selectize = field.selectizeInstance;
            if (selectize) { selectize.setValue(''); }
            else { field.value(''); }

            field.emit('change');
            body.emit('input', { target: field });
            body.emit('keyup', { target: field });
        }
    });

    body.on('statechangeEnd', function() {
        var State = History.getState();
        body.emit('updateOriginalFields');
    });

    body.on('updateOriginalFields', function() {
        originals = collectFieldsValues();
        compare.presets();
    });

    // force a presets comparison check
    compare.presets();
});

module.exports = {
    compare: compare,
    collect: collectFieldsValues
};

},{"../utils/flags-state":63,"../utils/history":68,"elements/attributes":98,"elements/domready":101,"mout/array/invoke":147,"mout/collection/forEach":156,"mout/lang/deepEquals":169,"mout/lang/is":170,"mout/lang/isString":179,"mout/object/has":200,"prime/map":268}],7:[function(require,module,exports){
"use strict";
// deprecated 5.2.0
var prime      = require('prime'),
    $          = require('elements'),
    Base       = require('./base'),
    zen        = require('elements/zen'),
    getAjaxURL = require('../../utils/get-ajax-url').config;

var Atom = new prime({
    inherits: Base,
    options: {
        type: 'atom'
    },

    constructor: function(options) {
        Base.call(this, options);

        this.on('changed', this.hasChanged);
    },

    updateTitle: function(title) {
        this.block.find('.title').text(title);
        this.setTitle(title);
        return this;
    },

    layout: function() {
        var settings_uri = getAjaxURL(this.getPageId() + '/layout/' + this.getType() + '/' + this.getId()),
            subtype      = this.getSubType() ? 'data-lm-blocksubtype="' + this.getSubType() + '"' : '';
        return '<div class="' + this.getType() + '" data-lm-id="' + this.getId() + '" data-lm-blocktype="' + this.getType() + '" ' + subtype + '><span><span class="title">' + this.getTitle() + '</span><span class="font-small">' + (this.getSubType() || this.getKey() || this.getType()) + '</span></span><div class="float-right"><i aria-label="Configure Atom Settings" class="fa fa-cog" data-lm-nodrag data-lm-nodrag data-lm-settings="' + settings_uri + '"></i></div></div>';
    },

    hasChanged: function(state, parent) {
        var icon = this.block.find('span > i.changes-indicator:first-child');

        // if the particle has changes but the parent block doesn't, we want to keep the indicator showing
        if (icon && parent && !parent.changeState) { return; }

        this.block[state ? 'addClass' : 'removeClass']('block-has-changes');

        if (!state && icon) { icon.remove(); }
        if (state && !icon) { zen('i.fa.fa-circle-o.changes-indicator').before(this.block.find('.icon')); }
    },

    onRendered: function(element, parent) {
        var globally_disabled = $('[data-lm-disabled][data-lm-subtype="' + this.getSubType() + '"]');

        if (globally_disabled || this.getAttribute('enabled') === 0) { this.disable(); }
    }
});

module.exports = Atom;

},{"../../utils/get-ajax-url":65,"./base":9,"elements":103,"elements/zen":106,"prime":267}],8:[function(require,module,exports){
"use strict";
// deprecated (5.2.0)
var prime   = require('prime'),
    $       = require('elements'),
    zen     = require('elements/zen'),
    bind    = require('mout/function/bind'),
    Section = require('./section');

var Atoms = new prime({
    inherits: Section,
    options: {
        type: 'atoms',
        attributes: {
            name: "Atoms Section"
        }
    },

    layout: function() {
        this.deprecated = '<div class="atoms-notice">Looking for Atoms? To make it easier we moved them in the <a href="#"><i class="fa fa-fw fa-list-alt"></i> Page Settings</a>.</div>';

        return '<div class="atoms-section" style="display: none;" data-lm-id="' + this.getId() + '" data-lm-blocktype="' + this.getType() + '"><div class="section-header clearfix"><h4 class="float-left">' + (this.getAttribute('name')) + '</h4></div></div>';
    },

    getId: function() {
        return this.id || (this.id = this.options.type);
    },

    onDone: function(event) {
        // Gantry 5.2.0: Remove atoms section if empty to keep the layout clear
        if (!this.block.search('[data-lm-blocktype="atom"]')) {
            var ids = [this.getId()], segments = this.block.search('[data-lm-id]');
            if (segments) {
                segments.forEach(function(element) {
                    ids.push($(element).data('lm-id'));
                });
            }

            ids.reverse().forEach(bind(function(id) {
                this.options.builder.remove(id);
            }, this));

            this.block.empty()[0].outerHTML = this.deprecated;
            this._attachRedirect();

            return;
        }

        if (!this.block.search('[data-lm-id]')) {
            this.grid.insert(this.block, 'bottom');
            this.options.builder.add(this.grid);
        }

        zen('div').html(this.deprecated).firstChild().after(this.block);

        this._attachRedirect();
    },

    _attachRedirect: function() {
        var item = $('[data-g5-nav="page"]');
        if (!item) { return; }

        $('.atoms-notice a').on('click', function(event) {
            event.preventDefault();
            $('body').emit('click', { target: item });
        });
    }
});

module.exports = Atoms;

},{"./section":17,"elements":103,"elements/zen":106,"mout/function/bind":159,"prime":267}],9:[function(require,module,exports){
"use strict";
var prime   = require('prime'),
    Options = require('prime-util/prime/options'),
    Bound    = require('prime-util/prime/bound'),
    Emitter = require('prime/emitter'),
    zen     = require('elements/zen'),
    trim    = require('mout/string/trim'),
    $       = require('elements'),
    ID      = require('../id'),

    get     = require('mout/object/get'),
    has     = require('mout/object/has'),
    set     = require('mout/object/set');

require('elements/traversal');

var Base = new prime({
    mixin: [Bound, Options],
    inherits: Emitter,
    options: {
        subtype: false,
        attributes: {}
    },
    constructor: function(options) {
        this.setOptions(options);

        this.fresh = !this.options.id;
        this.id = this.options.id || ID(this.options);
        this.attributes = this.options.attributes || {};

        this.block = zen('div').html(this.layout()).firstChild();

        this.on('rendered', this.bound('onRendered'));

        return this;
    },

    guid: function() {
        return guid();
    },

    getId: function() {
        return this.id || (this.id = ID(this.options));
    },

    getType: function() {
        return this.options.type || '';
    },

    getSubType: function() {
        return this.options.subtype || '';
    },

    getTitle: function() {
        return trim(this.options.title || 'Untitled');
    },

    setTitle: function(title) {
        this.options.title = trim(title || 'Untitled');
        return this;
    },

    getKey: function() {
        return '';
    },

    getPageId: function() {
        var root = $('[data-lm-root]');
        if (!root) return 'data-root-not-found';

        return root.data('lm-page');
    },

    getAttribute: function(key) {
        return get(this.attributes, key);
    },

    getAttributes: function() {
        return this.attributes || {};
    },

    updateTitle: function() {
        return this;
    },

    setAttribute: function(key, value) {
        set(this.attributes, key, value);
        return this;
    },

    setAttributes: function(attributes) {
        this.attributes = attributes;

        return this;
    },

    hasAttribute: function(key) {
        return has(this.attributes, key);
    },

    disable: function() {
        this.block.title('This particle has been disabled and it won\'t be rendered on front-end. You can still configure, move and delete.');
        this.block.addClass('particle-disabled');
    },

    enable: function() {
        this.block.removeAttribute('title');
        this.block.removeClass('particle-disabled');
    },

    insert: function(target, location) {
        this.block[location || 'after'](target);
        return this;
    },

    adopt: function(element) {
        element.insert(this.block);
        return this;
    },

    isNew: function(fresh) {
        if (typeof fresh !== 'undefined') {
            this.fresh = !!fresh;
        }
        return this.fresh;
    },

    dropzone: function() {
        return 'data-lm-dropzone';
    },

    addDropzone: function(){
        this.block.data('lm-dropzone', true);
    },

    removeDropzone: function(){
        this.block.data('lm-dropzone', null);
    },

    layout: function() {},

    onRendered: function(){},

    setLayout: function(layout) {
        this.block = layout;
        return this;
    },

    getLimits: function() {
        return false;
    }
});

module.exports = Base;

},{"../id":24,"elements":103,"elements/traversal":105,"elements/zen":106,"mout/object/get":199,"mout/object/has":200,"mout/object/set":207,"mout/string/trim":237,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266}],10:[function(require,module,exports){
"use strict";
var prime     = require('prime'),
    Base      = require('./base'),
    $         = require('../../utils/elements.utils'),
    zen       = require('elements/zen'),
    precision = require('mout/number/enforcePrecision'),
    bind      = require('mout/function/bind');

var Block = new prime({
    inherits: Base,
    options: {
        type: 'block',
        attributes: {
            size: 100
        }
    },

    constructor: function(options) {
        Base.call(this, options);
        if (options.attributes && options.attributes.size) this.setAttribute('size', precision(options.attributes.size, 1));

        this.on('changed', this.hasChanged);
    },

    getSize: function() {
        return precision(this.getAttribute('size'), 1);
    },

    setSize: function(size, store) {
        size = typeof size === 'undefined' ? this.getSize() : Math.max(0, Math.min(100, parseFloat(size)));
        size = precision(size, 1);
        if (store) {
            this.setAttribute('size', size);
        }

        $(this.block).style({
            flex: '0 1 ' + size + '%',
            '-webkit-flex': '0 1 ' + size + '%',
            '-ms-flex': '0 1 ' + size + '%'
        });

        this.emit('resized', size, this);
    },

    setAnimatedSize: function(size, store) {
        size = typeof size === 'undefined' ? this.getSize() : Math.max(0, Math.min(100, parseFloat(size)));
        size = precision(size, 1);
        if (store) {
            this.setAttribute('size', size);
        }
        $(this.block).animate({
            flex: '0 1 ' + size + '%',
            '-webkit-flex': '0 1 ' + size + '%',
            '-ms-flex': '0 1 ' + size + '%'
        }, bind(function() {
            this.block.attribute('style', null);
            this.setSize(size);
        }, this));

        this.emit('resized', size, this);
    },

    setLabelSize: function(size) {
        var label = this.block.find('> .particle-size');
        if (!label) { return false; }

        label.text(precision(size, 1) + '%');
    },

    layout: function() {
        return '<div class="g-block" data-lm-id="' + this.getId() + '"' + this.dropzone() + ' data-lm-blocktype="block"></div>';
    },

    onRendered: function(element, parent) {
        if (element.block.find('> [data-lm-blocktype="section"]')) {
            this.removeDropzone();
        }

        if (!parent) { return; }

        var grandpa = parent.block.parent();
        if (grandpa.data('lm-root') || (grandpa.data('lm-blocktype') == 'container' && (grandpa.parent().data('lm-root') || grandpa.parent().data('lm-blocktype') == 'wrapper'))) {
            zen('span.particle-size').text(this.getSize() + '%').top(element.block);
            element.on('resized', this.bound('onResize'));
        }
    },

    onResize: function(resize) {
        this.setLabelSize(resize);
    },

    hasChanged: function(state) {
        var icon,
            child = this.block.find('> [data-lm-id]:not([data-lm-blocktype="section"]):not([data-lm-blocktype="container"])');

        this.changeState = state;

        if (!child) {
            child = this.block.find('> .particle-size');
            icon = child.find('i:first-child');

            if (!state && icon) { icon.remove(); }
            if (state && !icon) { zen('i.fa.fa-circle-o.changes-indicator').top(child); }

            return;
        }

        var mapped = this.options.builder.get(child.data('lm-id'));
        if (mapped) { mapped.emit('changed', state, this); }
    }
});

module.exports = Block;

},{"../../utils/elements.utils":60,"./base":9,"elements/zen":106,"mout/function/bind":159,"mout/number/enforcePrecision":190,"prime":267}],11:[function(require,module,exports){
"use strict";
var prime = require('prime'),
    Base = require('./base'),
    zen = require('elements/zen'),
    $ = require('elements'),
    getAjaxURL = require('../../utils/get-ajax-url').config;

var Container = new prime({
    inherits: Base,
    options: {
        type: 'container'
    },

    constructor: function(options) {
        Base.call(this, options);
        this.on('changed', this.hasChanged);
    },

    layout: function() {
        return '<div class="g-lm-container" data-lm-id="' + this.getId() + '" data-lm-blocktype="container"></div>';
    },

    onRendered: function(element, parent) {
        if (!parent) {
            this.addSettings(element);
        }
    },

    hasChanged: function(state, child) {
        var icon = this.block.find('span.title > i:first-child');

        // if the the event is triggered from a grid we need to be cautious not to override the proper state
        if (icon && child && !child.changeState) { return; }

        this.block[state ? 'addClass' : 'removeClass']('block-has-changes');

        if (!state && icon) { icon.remove(); }
        if (state && !icon) {
            var title = this.block.find('span.title');
            if (title) { zen('i.fa.fa-circle-o.changes-indicator').top(title); }
        }
    },

    addSettings: function(container) {
        var settings_uri = getAjaxURL(this.getPageId() + '/layout/' + this.getType() + '/' + this.getId()),
            wrapper      = zen('div.container-wrapper.clearfix').top(container.block),
            title        = zen('div.container-title').bottom(wrapper),
            actions      = zen('div.container-actions').bottom(wrapper);

        title.html('<span class="title">' + this.getType() + '</span>');
        actions.html('<span data-tip="Container settings" data-tip-place="top-left"><i aria-label="Configure Container Settings" class="fa fa-cog" data-lm-settings="' + settings_uri + '"></i></span>');
    }
});

module.exports = Container;

},{"../../utils/get-ajax-url":65,"./base":9,"elements":103,"elements/zen":106,"prime":267}],12:[function(require,module,exports){
"use strict";
var prime      = require('prime'),
    Base       = require('./base'),
    $          = require('elements'),
    getAjaxURL = require('../../utils/get-ajax-url').config;

var Grid = new prime({
    inherits: Base,
    options: {
        type: 'grid'
    },

    constructor: function(options) {
        Base.call(this, options);

        this.on('changed', this.hasChanged);
    },

    layout: function() {
        return '<div class="g-grid nowrap" data-lm-id="' + this.getId() + '" ' + this.dropzone() + '  data-lm-samewidth data-lm-blocktype="grid"></div>';
    },

    onRendered: function() {
        var parent = this.block.parent();
        if (parent && parent.data('lm-blocktype') == 'atoms') {
            this.block.removeClass('nowrap');
        }

        if (parent && parent.data('lm-root') || (parent.data('lm-blocktype') == 'container' && parent.parent().data('lm-root'))) {
            this.removeDropzone();
        }
    },

    hasChanged: function(state) {
        // Grids don't have room for an indicator so we forward it to the parent Section
        var parent = this.block.parent('[data-lm-blocktype="section"]'),
            id = parent ? parent.data('lm-id') : false;

        this.changeState = state;

        if (!parent || !id) { return; }

        if (this.options.builder) { this.options.builder.get(id).emit('changed', state, this); }
    }
});

module.exports = Grid;

},{"../../utils/get-ajax-url":65,"./base":9,"elements":103,"prime":267}],13:[function(require,module,exports){
module.exports = {
    base: require('./base'),
    atom: require('./atom'),
    section: require('./section'),
    offcanvas: require('./offcanvas'),
    wrapper: require('./wrapper'),
    atoms: require('./atoms'),
    grid: require('./grid'),
    container: require('./container'),
    block: require('./block'),
    particle: require('./particle'),
    position: require('./position'),
    system: require('./system'),
    spacer: require('./spacer')
};

},{"./atom":7,"./atoms":8,"./base":9,"./block":10,"./container":11,"./grid":12,"./offcanvas":14,"./particle":15,"./position":16,"./section":17,"./spacer":18,"./system":19,"./wrapper":20}],14:[function(require,module,exports){
"use strict";
var prime   = require('prime'),
    Section = require('./section'),

    getAjaxURL = require('../../utils/get-ajax-url').config;

var Offcanvas = new prime({
    inherits: Section,
    options: {
        type: 'offcanvas',
        attributes: {
            name: "Offcanvas Section"
        }
    },

    layout: function() {
        var settings_uri = getAjaxURL(this.getPageId() + '/layout/' + this.getType() + '/' + this.getId());
        return '<div class="offcanvas-section" data-lm-id="' + this.getId() + '" data-lm-blocktype="' + this.getType() + '"><div class="section-header clearfix"><h4 class="float-left">' + (this.getAttribute('name')) + '</h4><div class="section-actions float-right"><span data-tip="Adds a new row in the offcanvas" data-tip-place="top-left"><i class="fa fa-plus"></i></span> <span data-tip="Offcanvas settings" data-tip-place="top-left"><i aria-label="Configure Offcanvas Settings" class="fa fa-cog" data-lm-settings="' + settings_uri + '"></i></span></div></div></div>';
    },

    getId: function() {
        return this.id || (this.id = this.options.type);
    }
});

module.exports = Offcanvas;

},{"../../utils/get-ajax-url":65,"./section":17,"prime":267}],15:[function(require,module,exports){
"use strict";
var prime      = require('prime'),
    $          = require('elements'),
    Atom       = require('./atom'),
    bind       = require('mout/function/bind'),
    precision  = require('mout/number/enforcePrecision'),
    getAjaxURL = require('../../utils/get-ajax-url').config;

var UID = 0;

var Particle = new prime({
    inherits: Atom,
    options: {
        type: 'particle'
    },

    constructor: function(options) {
        ++UID;
        Atom.call(this, options);
    },

    layout: function() {
        var settings_uri = getAjaxURL(this.getPageId() + '/layout/' + this.getType() + '/' + this.getId()),
            subtype      = this.getSubType() ? 'data-lm-blocksubtype="' + this.getSubType() + '"' : '';

        return '<div class="' + this.getType() + '" data-lm-id="' + this.getId() + '" data-lm-blocktype="' + this.getType() + '" ' + subtype + '><span><span class="icon"><i class="fa ' + this.getIcon() + '"></i></span><span class="title">' + this.getTitle() + '</span><span class="font-small">' + (this.getKey() || this.getSubType() || this.getType()) + '</span></span><div class="float-right"><span class="particle-size"></span> <i aria-label="Configure Particle Settings" class="fa fa-cog" data-lm-nodrag data-lm-settings="' + settings_uri + '"></i></div></div>';
    },

    setLabelSize: function(size) {
        var label = this.block.find('.particle-size');
        if (!label) { return false; }

        label.text(precision(size, 1) + '%');
    },

    onRendered: function(element, parent) {
        var size              = parent.getSize() || 100,
            globally_disabled = $('[data-lm-disabled][data-lm-subtype="' + this.getSubType() + '"]');

        if (globally_disabled || this.getAttribute('enabled') === 0) { this.disable(); }

        this.setLabelSize(size);
        parent.on('resized', this.bound('onParentResize'));
    },

    getParent: function() {
        var parent = this.block.parent('[data-lm-id]');

        return this.options.builder.get(parent.data('lm-id'));
    },

    onParentResize: function(resize) {
        this.setLabelSize(resize);
    },

    getIcon: function() {
        var type = this.getType(),
            subtype = this.getSubType(),
            template = $('.particles-container [data-lm-blocktype="' + type + '"][data-lm-subtype="' + subtype + '"]');

        return template ? template.data('lm-icon') : 'fa-cube';
    },

    getLimits: function(parent) {
        if (!parent) { return false; }

        var sibling = parent.block.nextSibling() || parent.block.previousSibling() || false;

        if (!sibling) { return [100, 100]; }

        var siblingBlock = this.options.builder.get(sibling.data('lm-id')),
            sizes = {
                current: this.getParent().getSize(),
                sibling: siblingBlock.getSize()
            };

        return [5, (sizes.current + sizes.sibling) - 5];
    }
});

module.exports = Particle;

},{"../../utils/get-ajax-url":65,"./atom":7,"elements":103,"mout/function/bind":159,"mout/number/enforcePrecision":190,"prime":267}],16:[function(require,module,exports){
"use strict";
var prime    = require('prime'),
    trim     = require('mout/string/trim'),
    Particle = require('./particle');

var UID = 0;

var Position = new prime({
    inherits: Particle,
    options: {
        type: 'position'
    },

    constructor: function(options) {
        ++UID;
        Particle.call(this, options);
        this.setAttribute('title', this.getTitle());
        this.setAttribute('key', this.getKey());

        if (this.isNew()) { --UID; }
    },

    getTitle: function() {
        return trim(this.options.title || 'Position ' + UID);
    },

    getKey: function() {
        return (this.getAttribute('key') || trim(this.getTitle()).replace(/\s/g, '-').toLowerCase());
    },

    updateKey: function(key) {
        this.options.key = key || this.getKey();
        this.block.find('.font-small').text(this.getKey());
        return this;
    },
});

module.exports = Position;

},{"./particle":15,"mout/string/trim":237,"prime":267}],17:[function(require,module,exports){
"use strict";
var prime = require('prime'),
    Base  = require('./base'),
    Bound = require('prime-util/prime/bound'),
    Grid  = require('./grid'),
    $     = require('elements'),
    zen   = require('elements/zen'),

    bind  = require('mout/function/bind'),
    getAjaxURL = require('../../utils/get-ajax-url').config;

require('elements/insertion');

var UID = 0;

var Section = new prime({
    inherits: Base,
    options: {},

    constructor: function(options) {
        ++UID;
        this.grid = new Grid();
        Base.call(this, options);

        this.on('done', this.bound('onDone'));
        this.on('changed', this.hasChanged);
    },

    layout: function() {
        var settings_uri = getAjaxURL(this.getPageId() + '/layout/' + this.getType() + '/' + this.getId());

        return '<div class="section" data-lm-id="' + this.getId() + '" data-lm-blocktype="' + this.getType() + '" data-lm-blocksubtype="' + this.getSubType() + '"><div class="section-header clearfix"><h4 class="float-left">' + (this.getTitle()) + '</h4><div class="section-actions float-right"><span data-tip="Adds a new row in the section" data-tip-place="top-right"><i aria-label="Add a new row" class="fa fa-plus"></i></span> <span data-tip="Section settings" data-tip-place="top-right"><i aria-label="Configure Section Settings" class="fa fa-cog" data-lm-settings="' + settings_uri + '"></i></span></div></div></div>';
    },

    adopt: function(child) {
        $(child).insert(this.block.find('.g-grid'));
    },

    hasChanged: function(state, child) {
        var icon = this.block.find('h4 > i:first-child');

        // if the the event is triggered from a grid we need to be cautious not to override the proper state
        if (icon && child && !child.changeState) { return; }

        this.block[state ? 'addClass' : 'removeClass']('block-has-changes');

        if (!state && icon) { icon.remove(); }
        if (state && !icon) { zen('i.fa.fa-circle-o.changes-indicator').top(this.block.find('h4')); }
    },

    onDone: function(event) {
        if (!this.block.search('[data-lm-id]')) {
            this.grid.insert(this.block, 'bottom');
            this.options.builder.add(this.grid);
        }

        var plus = this.block.find('.fa-plus');
        if (plus) {
            plus.on('click', bind(function(e) {
                if (e) { e.preventDefault(); }

                if (this.block.find('.g-grid:last-child:empty')) { return false; }

                this.grid = new Grid();
                this.grid.insert(this.block.find('[data-lm-blocktype="container"]') ? this.block.find('[data-lm-blocktype="container"]') : this.block, 'bottom');
                this.options.builder.add(this.grid);
            }, this));
        }
    },

    getParent: function() {
        var parent = this.block.parent('[data-lm-id]');

        return this.options.builder.get(parent.data('lm-id'));
    },

    getLimits: function(parent) {
        if (!parent) { return false; }

        var sibling = parent.block.nextSibling() || parent.block.previousSibling() || false;

        if (!sibling) { return [100, 100]; }

        var siblingBlock = this.options.builder.get(sibling.data('lm-id'));
        if (siblingBlock.getType() !== 'block') { return false; }

        var sizes = {
                current: this.getParent().getSize(),
                sibling: siblingBlock.getSize()
            };

        return [5, (sizes.current + sizes.sibling) - 5];
    }
});

module.exports = Section;

},{"../../utils/get-ajax-url":65,"./base":9,"./grid":12,"elements":103,"elements/insertion":104,"elements/zen":106,"mout/function/bind":159,"prime":267,"prime-util/prime/bound":263}],18:[function(require,module,exports){
"use strict";
var prime    = require('prime'),
    Particle = require('./particle');

var UID = 0;

var Spacer = new prime({
    inherits: Particle,
    options: {
        type: 'spacer',
        title: 'Spacer',
        attributes: {}
    }
});

module.exports = Spacer;

},{"./particle":15,"prime":267}],19:[function(require,module,exports){
"use strict";
var prime    = require('prime'),
    Particle = require('./particle');

var System = new prime({
    inherits: Particle,
    options: {
        type: 'system',
        attributes: {}
    }
});

module.exports = System;

},{"./particle":15,"prime":267}],20:[function(require,module,exports){
"use strict";
var prime   = require('prime'),
    Section = require('./section'),

    getAjaxURL = require('../../utils/get-ajax-url').config;

var Wrapper = new prime({
    inherits: Section,
    options: {
        type: 'wrapper',
        attributes: {
            name: "Wrapper"
        }
    },

    layout: function() {
        var settings_uri = getAjaxURL(this.getPageId() + '/layout/' + this.getType() + '/' + this.getId());
        return '<div class="wrapper-section" data-lm-id="' + this.getId() + '" data-lm-blocktype="' + this.getType() + '" data-lm-blocksubtype="' + this.getSubType() + '"></div>';
    },

    hasChanged: function() {},

    getSize: function() {
        return false;
    },

    getId: function() {
        return this.id || (this.id = this.options.type);
    }
});

module.exports = Wrapper;

},{"../../utils/get-ajax-url":65,"./section":17,"prime":267}],21:[function(require,module,exports){
"use strict";
var prime   = require('prime'),
    $       = require('elements'),
    Emitter = require('prime/emitter');

var Blocks = require('./blocks/');

var forOwn     = require('mout/object/forOwn'),
    forEach    = require('mout/collection/forEach'),
    size       = require('mout/collection/size'),
    isArray    = require('mout/lang/isArray'),
    flatten    = require('mout/array/flatten'),
    ID         = require('./id'),

    set        = require('mout/object/set'),
    unset      = require('mout/object/unset'),
    get        = require('mout/object/get'),
    deepFillIn = require('mout/object/deepFillIn'),
    omit       = require('mout/object/omit');

require('elements/attributes');
require('elements/traversal');


// start Debug
var DEBUG  = false,
    rpad   = require('mout/string/rpad'),
    repeat = require('mout/string/repeat');
// end   Debug

$.implement({
    empty: function() {
        return this.forEach(function(node) {
            var first;
            while ((first = node.firstChild)) {
                node.removeChild(first);
            }
        });
    }
});

var Builder = new prime({

    inherits: Emitter,

    constructor: function(structure) {
        if (structure) {
            this.setStructure(structure);
        }
        this.map = {};

        return this;
    },

    setStructure: function(structure) {
        try {
            this.structure = (typeof structure === 'object') ? structure : JSON.parse(structure);
        }
        catch (e) {
            console.error("Parsing error:", e);
        }
    },

    add: function(block) {
        var id = typeof block === 'string' ? block : block.id;
        set(this.map, id, block);
        block.isNew(false);
    },

    remove: function(block) {
        block = typeof block === 'string' ? block : block.id;
        unset(this.map, block);
    },

    get: function(block) {
        var id = typeof block === 'string' ? block : block.id;
        return get(this.map, id, block);
    },

    load: function(data) {
        this.recursiveLoad(data);
        this.emit('loaded', data);

        return this;
    },

    serialize: function(root, flat) {
        var serieChildren = [];
        root = root || $('[data-lm-root]');

        if (!root) { return; }

        var blocks = root.search((!flat ? '> ' : '') + '[data-lm-id]'),
            id, type, subtype, serial, hasChildren, children;

        forEach(blocks, function(element) {
            element = $(element);
            id = element.data('lm-id');
            type = element.data('lm-blocktype');
            subtype = element.data('lm-blocksubtype') || false;
            hasChildren = element.search('> [data-lm-id]');

            if (flat) {
                children = hasChildren ? hasChildren.map(function(element){ return $(element).data('lm-id'); }) : false;
            } else {
                children = hasChildren ? this.serialize(element) : [];
            }

            serial = {
                id: id,
                type: type,
                subtype: subtype,
                title: get(this.map, id) ? get(this.map, id).getTitle() : 'Untitled',
                attributes: get(this.map, id) ? get(this.map, id).getAttributes() : {},
                children: children
            };

            if (flat) {
                var obj = {}; obj[id] = serial;
                serial = obj;
            }

            serieChildren.push(serial);
        }, this);

        return serieChildren;
    },

    insert: function(key, value, parent/*, object*/) {
        var root = $('[data-lm-root]');
        if (!root) {
            return;
        }

        if (!Blocks[value.type]) {
            console[console.error ? 'error' : 'log'](value.type + ' does not exist');
        }

        var Element = new (Blocks[value.type] || Blocks['section'])(deepFillIn({
            id: key,
            attributes: {},
            subtype: value.subtype || false,
            builder: this
        }, omit(value, 'children')));

        if (!parent) {
            Element.block.insert(root);
        }
        else {
            Element.block.insert($('[data-lm-id="' + parent + '"]'));
        }

        if (Element.getType() === 'block') {
            Element.setSize();
        }

        this.add(Element);
        Element.emit('rendered', Element, parent ? get(this.map, parent) : null);

        return Element;
    },

    reset: function(data) {
        this.map = {};
        this.setStructure(data || {});
        $('[data-lm-root]').empty();
        this.load();
    },

    cleanupLonely: function() {
        var ghosts = [],
            parent, children = $('[data-lm-root] > .g-section > .g-grid > .g-block .g-grid > .g-block, [data-lm-root] > .g-section > .g-grid > .g-block > .g-block');

        if (!children) {
            return;
        }


        var isGrid;
        children.forEach(function(child) {
            child = $(child);
            parent = null;
            isGrid = child.parent().hasClass('g-grid');

            if (isGrid && child.siblings()) {
                return false;
            }

            if (isGrid) {
                ghosts.push(child.data('lm-id'));
                parent = child.parent();
            }

            ghosts.push(child.data('lm-id'));
            child.children().before(parent ? parent : child);
            (parent ? parent : child).remove();
        });

        return ghosts;
    },

    recursiveLoad: function(data, callback, depth, parent) {
        data = data || this.structure;
        depth = depth || 0;
        parent = parent || false;
        callback = callback || this.insert;

        forEach(data, function(value/*, key, object*/) {

            if (!value.id) {
                value.id = ID({ builder: { map: this.map }, type: value.type, subtype: value.subtype });
            }

            // debug (flat view of the structure)
            if (console && console.log && DEBUG) {
                console.log(rpad(repeat('    ', depth) + '' + value.type, 35) + ' (' + rpad(value.id, 36) + ') parent: ' + parent);
            }

            this.emit('loading', callback.call(this, value.id, value, parent, depth));
            if (value.children && size(value.children)) {
                depth++;

                forEach(value.children, function(childValue/*, childKey, array*/) {
                    this.recursiveLoad([childValue], callback, depth, value.id);
                }, this);
            }

            this.get(value.id).emit('done', this.get(value.id));

            depth--;
        }, this);
    }
});

module.exports = Builder;

},{"./blocks/":13,"./id":24,"elements":103,"elements/attributes":98,"elements/traversal":105,"mout/array/flatten":142,"mout/collection/forEach":156,"mout/collection/size":158,"mout/lang/isArray":171,"mout/object/deepFillIn":192,"mout/object/forOwn":198,"mout/object/get":199,"mout/object/omit":206,"mout/object/set":207,"mout/object/unset":210,"mout/string/repeat":231,"mout/string/rpad":234,"prime":267,"prime/emitter":266}],22:[function(require,module,exports){
"use strict";
var DragEvents = require('../ui/drag.events'),
    prime      = require('prime'),
    Emitter    = require('prime/emitter'),
    Bound      = require('prime-util/prime/bound'),
    Options    = require('prime-util/prime/options'),
    bind       = require('mout/function/bind'),
    isString   = require('mout/lang/isString'),
    nMap       = require('mout/math/map'),
    clamp      = require('mout/math/clamp'),
    precision  = require('mout/number/enforcePrecision'),
    get        = require('mout/object/get'),
    $          = require('../utils/elements.utils');

require('elements/events');
require('elements/delegation');

var Resizer = new prime({
    mixin: [Bound, Options],
    DRAG_EVENTS: DragEvents,
    options: {
        minSize: 5
    },
    constructor: function(container, options) {
        this.setOptions(options);
        this.history = this.options.history || {};
        this.builder = this.options.builder || {};
        this.origin = {
            x: 0,
            y: 0,
            transform: null,
            offset: {
                x: 0,
                y: 0
            }
        };
    },

    getBlock: function(element) {
        return get(this.builder.map, isString(element) ? element : $(element).data('lm-id') || '');
    },

    getAttribute: function(element, prop) {
        return this.getBlock(element).getAttribute(prop);
    },

    getSize: function(element) {
        return this.getAttribute($(element), 'size');
    },

    start: function(event, element, siblings, offset) {
        if (event && event.type.match(/^touch/i)) { event.preventDefault(); }

        window.G5.tips.hide(element[0]);
        if (event.which && event.which !== 1) { return true; }

        // Stops text selection
        event.preventDefault();

        this.element = $(element);
        this.siblings = {
            occupied: 0,
            elements: siblings,
            next: this.element.nextSibling(),
            prevs: this.element.previousSiblings(),
            sizeBefore: 0
        };

        if (this.siblings.elements.length > 1) {
            this.siblings.occupied -= this.getSize(this.siblings.next);
            this.siblings.elements.forEach(function(sibling) {
                this.siblings.occupied += this.getSize(sibling);
            }, this);
        }

        if (this.siblings.prevs) {
            this.siblings.prevs.forEach(function(sibling) {
                this.siblings.sizeBefore += this.getSize(sibling);
            }, this);
        }

        this.origin = {
            size: this.getSize(this.element),
            maxSize: this.getSize(this.element) + this.getSize(this.siblings.next),
            x: event.changedTouches ? event.changedTouches[0].pageX : event.pageX + 6,
            y: event.changedTouches ? event.changedTouches[0].pageY : event.pageY
        };

        var clientRect = this.element[0].getBoundingClientRect(),
            parentRect = this.element.parent()[0].getBoundingClientRect();

        this.origin.offset = {
            clientRect: clientRect,
            parentRect: {left: parentRect.left, right: parentRect.right},
            x: this.origin.x - clientRect.right,
            y: clientRect.top - this.origin.y,
            down: offset
        };

        this.origin.offset.parentRect.left = this.element.parent().find('> [data-lm-id]:first-child')[0].getBoundingClientRect().left;
        this.origin.offset.parentRect.right = this.element.parent().find('> [data-lm-id]:last-child')[0].getBoundingClientRect().right;

        this.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
            $(document).on(event, this.bound('move'));
        }, this));

        this.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
            $(document).on(event, this.bound('stop'));
        }, this));
    },

    move: function(event) {
        if (event && event.type.match(/^touch/i)) { event.preventDefault(); }

        var clientX = event.clientX || event.touches[0].clientX || 0,
            clientY = event.clientY || event.touches[0].clientY || 0,
            parentRect = this.origin.offset.parentRect;

        var deltaX = (this.lastX || clientX) - clientX,
            deltaY = (this.lastY || clientY) - clientY;

        this.direction =
            Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0 && 'left' ||
            Math.abs(deltaX) > Math.abs(deltaY) && deltaX < 0 && 'right' ||
            Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0 && 'up' ||
                                                                 'down';
        var size,
            diff = 100 - this.siblings.occupied,
            value = clientX + (!this.siblings.prevs ? this.origin.offset.x - this.origin.offset.down : this.siblings.prevs.length),
            normalized = clamp(value, parentRect.left, parentRect.right);

        size = nMap(normalized, parentRect.left, parentRect.right, 0, 100);
        size = size - this.siblings.sizeBefore;
        size = precision(clamp(size, this.options.minSize, this.origin.maxSize - this.options.minSize), 0);

        //grids?
        //console.log((size / 12) * (100 / 12));

        diff = precision(diff - size, 0);

        this.getBlock(this.element).setSize(size, true);
        this.getBlock(this.siblings.next).setSize(diff, true);

        // Hack to handle cases where size is not an integer
        var siblings = this.element.siblings(),
            amount = siblings ? siblings.length + 1 : 1;
        if (amount == 3 || amount == 6 || amount == 7 || amount == 8 || amount == 9 || amount == 11 || amount == 12) {
            var total = 0, blocks;

            blocks = $([siblings, this.element]);
            blocks.forEach(function(block, index){
                block = this.getBlock(block);
                size = block.getSize();
                if (size % 1) {
                    size = precision(100 / amount, 0);
                    block.setSize(size, true);
                }

                total += size;

                if (blocks.length == index + 1 && total != 100) {
                    diff = 100 - total;
                    block.setSize(size + diff, true);
                }

            }, this);
        }

        this.lastX = clientX;
        this.lastY = clientY;
    },

    stop: function(event) {
        if (event && event.type.match(/^touch/i)) { event.preventDefault(); }

        this.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
            $(document).off(event, this.bound('move'));
        }, this));

        this.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
            $(document).off(event, this.bound('stop'));
        }, this));

        if (event.target.matches('[data-lm-back], [data-lm-forward]')) { return; }
        if (this.origin.size !== this.getSize(this.element)) { this.history.push(this.builder.serialize(), this.history.get().preset); }
    },

    evenResize: function(elements, animated) {
        var total = elements.length,
            size = precision(100 / total, 4),
            block;

        if (typeof animated === 'undefined') { animated = true; }

        elements.forEach(function(element) {
            element = $(element);
            block = this.getBlock(element);
            if (block && block.hasAttribute('size') && typeof block.getSize === 'function') {
                block[animated ? 'setAnimatedSize' : 'setSize'](size, size !== block.getSize());
            } else {
                if (element) { element[animated ? 'animate' : 'style']({ flex: '0 1 ' + size + '%' }); }
            }
        }, this);
    }
});

module.exports = Resizer;

},{"../ui/drag.events":47,"../utils/elements.utils":60,"elements/delegation":100,"elements/events":102,"mout/function/bind":159,"mout/lang/isString":179,"mout/math/clamp":184,"mout/math/map":186,"mout/number/enforcePrecision":190,"mout/object/get":199,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266}],23:[function(require,module,exports){
var prime      = require('prime'),
    Emitter    = require('prime/emitter'),
    slice      = require('mout/array/slice'),
    merge      = require('mout/object/merge'),
    deepEquals = require('mout/lang/deepEquals');

var History = new prime({

    inherits: Emitter,

    constructor: function(session, preset) {
        this.index = 0;
        session = merge({}, session);
        preset = merge({}, preset);
        this.setSession(session, preset);
    },

    undo: function() {
        if (!this.index) return;
        this.index--;

        var session = this.get();
        this.emit('undo', session, this.index);
        return session;
    },

    redo: function() {
        if (this.index == this.session.length - 1) return;
        this.index++;

        var session = this.get();
        this.emit('redo', session, this.index);
        return session;
    },

    reset: function() {
        this.index = 0;

        var session = this.get();
        this.emit('reset', session, this.index);
        return session;
    },

    push: function(session, preset) {
        session = merge({}, session);
        preset = merge({}, preset);
        var sliced = this.index < this.session.length - 1;
        if (this.index < this.session.length - 1) this.session = slice(this.session, 0, -(this.session.length - 1 - this.index));
        session = {
            time: +(new Date()),
            data: session,
            preset: preset
        };

        if (this.equals(session.data)) { return session; }

        this.session.push(session);
        this.index = this.session.length - 1;

        this.emit('push', session, this.index, sliced);
        return session;
    },

    get: function(index) {
        return this.session[index || this.index] || false;
    },

    equals: function(session, compare) {
        if (!compare) { compare = this.get().data; }

        return deepEquals(session, compare);
    },

    setSession: function(session, preset) {
        session = !session ? []
            : [{
            time: +(new Date()),
            data: merge({}, session),
            preset: preset
        }];

        this.session = session;
        this.index = 0;
        return this.session;
    },

    import: function() {},
    export: function() {}
});

module.exports = History;

},{"mout/array/slice":151,"mout/lang/deepEquals":169,"mout/object/merge":203,"prime":267,"prime/emitter":266}],24:[function(require,module,exports){
'use strict';

var keys     = require('mout/object/keys'),
    contains = require('mout/array/contains'),
    rand     = require('mout/random/randInt');

var ID = function(options) {
    var map     = options.builder ? keys(options.builder.map) : {},
        type    = options.type,
        subtype = options.subtype,

        result  = [], key, id;

    if (type != 'particle') result.push(type);
    if (subtype)  result.push(subtype);

    key = result.join('-');

    while (id = rand(1000, 9999)) {
        if (!contains(map, key + '-' + id)) {
            break;
        }
    }

    return key + '-' + id;
};

module.exports = ID;
},{"mout/array/contains":135,"mout/object/keys":202,"mout/random/randInt":220}],25:[function(require,module,exports){
"use strict";
var ready          = require('elements/domready'),
    $              = require('elements/attributes'),
    modal          = require('../ui').modal,
    toastr         = require('../ui').toastr,
    sidebar        = require('./particles-sidebar'),
    request        = require('agent'),
    zen            = require('elements/zen'),
    contains       = require('mout/array/contains'),
    size           = require('mout/collection/size'),
    trim           = require('mout/string/trim'),
    strReplace     = require('mout/string/replace'),
    properCase     = require('mout/string/properCase'),
    forEach        = require('mout/collection/forEach'),
    precision      = require('mout/number/enforcePrecision'),

    getAjaxSuffix = require('../utils/get-ajax-suffix'),
    parseAjaxURI  = require('../utils/get-ajax-url').parse,
    getAjaxURL    = require('../utils/get-ajax-url').global,

    flags         = require('../utils/flags-state'),
    Builder        = require('./builder'),
    History        = require('../utils/history'),
    validateField  = require('../utils/field-validation'),
    LMHistory      = require('./history'),
    LayoutManager  = require('./layoutmanager'),
    SaveState      = require('../utils/save-state');

require('../ui/popover');

var builder, layoutmanager, lmhistory, savestate, Tips;

builder = new Builder();
lmhistory = new LMHistory();
savestate = new SaveState();

ready(function() {
    var body = $('body');

    body.delegate('click', '[data-lm-back]', function(e, element) {
        if (e) { e.preventDefault(); }
        if ($(element).hasClass('disabled')) return false;
        lmhistory.undo();
    });

    body.delegate('click', '[data-lm-forward]', function(e, element) {
        if (e) { e.preventDefault(); }
        if ($(element).hasClass('disabled')) return false;
        lmhistory.redo();
    });

    /* lmhistory events */
    lmhistory.on('push', function(session, index, reset) {
        var HM = {
            back: $('[data-lm-back]'),
            forward: $('[data-lm-forward]')
        };

        if (index && HM.back && HM.back.hasClass('disabled')) HM.back.removeClass('disabled');
        if (reset && HM.forward && !HM.forward.hasClass('disabled')) HM.forward.addClass('disabled');
        layoutmanager.updatePendingChanges();
    });

    lmhistory.on('undo', function(session, index) {
        var notice = $('#lm-no-layout'),
            title = $('.layout-title .title small'),
            preset_name = session.preset.name || 'Default',
            HM = {
                back: $('[data-lm-back]'),
                forward: $('[data-lm-forward]')
            };

        if (notice) { notice.style({ display: !size(session.data) ? 'block' : 'none' }); }
        if (title) { title.text('(' + properCase(trim(strReplace(preset_name, [/_/g, /\//g], [' ', ' / ']))) + ')'); }

        builder.reset(session.data);
        HM.forward.removeClass('disabled');
        if (!index) HM.back.addClass('disabled');
        layoutmanager.singles('disable');
        layoutmanager.updatePendingChanges();
    });
    lmhistory.on('redo', function(session, index) {
        var notice = $('#lm-no-layout'),
            title = $('.layout-title .title small'),
            preset_name = session.preset.name || 'Default',
            HM = {
                back: $('[data-lm-back]'),
                forward: $('[data-lm-forward]')
            };

        if (notice) { notice.style({ display: !size(session.data) ? 'block' : 'none' }); }
        if (title) { title.text('(' + properCase(trim(strReplace(preset_name, [/_/g, /\//g], [' ', ' / ']))) + ')'); }

        builder.reset(session.data);
        HM.back.removeClass('disabled');
        if (index == this.session.length - 1) HM.forward.addClass('disabled');
        layoutmanager.singles('disable');
        layoutmanager.updatePendingChanges();
    });

});

ready(function() {
    var body = $('body'), root = $('[data-lm-root]'), data;

    // Layout Manager
    layoutmanager = new LayoutManager('[data-lm-container]', {
        delegate: '[data-lm-root] .g-grid > .g-block > [data-lm-blocktype]:not([data-lm-nodrag]) !> .g-block, .g5-lm-particles-picker [data-lm-blocktype], [data-lm-root] [data-lm-blocktype="section"] > [data-lm-blocktype="grid"]:not(:empty):not(.no-move):not([data-lm-nodrag]), [data-lm-root] [data-lm-blocktype="section"] > [data-lm-blocktype="container"] > [data-lm-blocktype="grid"]:not(:empty):not(.no-move):not([data-lm-nodrag]), [data-lm-root] [data-lm-blocktype="offcanvas"] > [data-lm-blocktype="grid"]:not(:empty):not(.no-move):not([data-lm-nodrag]), [data-lm-root] [data-lm-blocktype="offcanvas"] > [data-lm-blocktype="container"] > [data-lm-blocktype="grid"]:not(:empty):not(.no-move):not([data-lm-nodrag])',
        droppables: '[data-lm-dropzone]',
        exclude: '.section-header .button, .lm-newblocks .float-right .button, [data-lm-nodrag]',
        resize_handles: '[data-lm-root] .g-grid > .g-block:not(:last-child)',
        builder: builder,
        history: lmhistory,
        savestate: savestate
    });

    module.exports.layoutmanager = layoutmanager;

    // load builder data
    if (root) {
        data = JSON.parse(root.data('lm-root'));
        if (data.name) { data = data.layout; }
        builder.setStructure(data);
        builder.load();

        layoutmanager.history.setSession(builder.serialize(), JSON.parse(root.data('lm-preset')));
        layoutmanager.savestate.setSession(builder.serialize(null, true));
    }

    // attach events
    // Modal Tabs
    body.delegate('click', '.g-tabs a', function(event, element) {
        event.preventDefault();
        return false;
    });
    body.delegate('keydown', '.g-tabs a', function(event, element) {
        var key = (event.which ? event.which : event.keyCode);
        if (key == 32 || key == 13) { // ARIA support: Space / Enter toggle
            event.preventDefault();
            body.emit('mouseup', event);
            return false;
        }
    });
    body.delegate('mouseup', '.g-tabs a', function(event, element) {
        element = $(element);
        event.preventDefault();

        var index = 0,
            parent = element.parent('.g-tabs'),
            panes = parent.siblings('.g-panes'),
            links = parent.search('a');

        links.forEach(function(link, i) {
            if (link == element[0]) { index = i + 1; }
        });

        panes.find('.active').removeClass('active');
        parent.find('.active').removeClass('active');
        panes.find('.g-pane:nth-child(' + index + ')').addClass('active');
        parent.find('li:nth-child(' + index + ')').addClass('active');

        // ARIA
        if (panes.search('[aria-expanded]')) { panes.search('[aria-expanded]').attribute('aria-expanded', 'false'); }
        if (parent.search('[aria-expanded]')) { parent.search('[aria-expanded]').attribute('aria-expanded', 'false'); }

        panes.find('.g-pane:nth-child(' + index + ')').attribute('aria-expanded', 'true');
        if (parent.find('li:nth-child(' + index + ') [aria-expanded]')) { parent.find('li:nth-child(' + index + ') [aria-expanded]').attribute('aria-expanded', 'true'); }
    });

    // Picker
    body.delegate('statechangeBefore', '[data-g5-lm-picker]', function() {
        modal.close();
    });

    // Sub-navigation links
    body.on('statechangeAfter', function(event, element) {
        root = $('[data-lm-root]');
        if (!root) { return true; }
        data = JSON.parse(root.data('lm-root'));
        builder.setStructure(data);
        builder.load();

        layoutmanager.refresh();
        layoutmanager.history.setSession(builder.serialize(), JSON.parse(root.data('lm-preset')));
        layoutmanager.savestate.setSession(builder.serialize(null, true));

        // refresh LM eraser
        layoutmanager.eraser.element = $('[data-lm-eraseblock]');
        layoutmanager.eraser.hide(true);
    });

    // Particles filtering
    body.delegate('input', '.sidebar-block .search input', function(event, element) {
        var value = $(element).value().toLowerCase(),
            list = $('.sidebar-block [data-lm-blocktype]'),
            text, type;
        if (!list) { return false; }

        list.style({ display: 'none' }).forEach(function(blocktype) {
            blocktype = $(blocktype);
            type = blocktype.data('lm-blocktype').toLowerCase();
            text = trim(blocktype.text()).toLowerCase();
            if (type.substr(0, value.length) == value || text.match(value)) {
                blocktype.style({ display: 'block' });
            }
        }, this);
    });

    // Grid same widths button (evenize, equalize)
    ['click', 'touchend'].forEach(function(evt){
        body.delegate(evt, '[data-lm-samewidth]:not(:empty)', function(event, element) {
            window.G5.tips.hide(element[0]);
            var clientRect = element[0].getBoundingClientRect();
            if ((event.clientX || event.pageX || event.changedTouches[0].pageX || 0) < clientRect.width + clientRect.left) { return; }

            var blocks = element.search('> [data-lm-blocktype="block"]'), id;
            if (!blocks || blocks.length == 1) { return; }

            blocks.forEach(function(block) {
                id = $(block).data('lm-id');
                builder.get(id).setSize(100 / blocks.length, true);
            });

            lmhistory.push(builder.serialize(), lmhistory.get().preset);
        });
    });

    body.delegate('mouseover', '[data-lm-samewidth]:not(:empty)', function(event, element) {
        var clientRect = element[0].getBoundingClientRect(),
            clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0,
            tooltips = {
                equalize: clientX + 5 > clientRect.width + clientRect.left,
                move: clientX - 5 < clientRect.left
            };

        if (!tooltips.equalize && !tooltips.move) { return; }

        var msg = tooltips.equalize ? 'Equalize the width of blocks in this grid' : 'Sort or Move the Grid';

        element.data('tip', msg).data('tip-offset', -30);

        window.G5.tips
            .get(element[0])
            .content(msg)
            .place(tooltips.equalize ? 'top-left' : 'top-right')
            .show();
    });

    body.delegate('mouseout', '[data-lm-samewidth]:not(:empty)', function(event, element) {
        window.G5.tips.hide(element[0]);
    });

    // Clear Layout
    body.delegate('click', '[data-lm-clear]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }

        var type, child;
        forEach(builder.map, function(obj, id) {
            type = obj.getType();
            child = obj.block.find('> [data-lm-id]');
            if (child) { child = child.data('lm-blocktype'); }
            if (contains(['particle', 'grid', 'block'], type) && (type == 'block' && (child && (child !== 'section' && child !== 'container')))) {
                builder.remove(id);
                obj.block.remove();
            }
        }, this);

        layoutmanager.singles('cleanup', builder);

        lmhistory.push(builder.serialize(), lmhistory.get().preset);
    });

    // Switcher
    var SWITCHER_HIT = false;
    body.delegate('mouseover', '[data-lm-switcher]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }

        SWITCHER_HIT = element;
        if (!element.PopoverDefined) {
            element.getPopover({
                type: 'async',
                width: '500',
                url: parseAjaxURI(element.data('lm-switcher') + getAjaxSuffix()),
                allowElementsClick: '.g-tabs a'
            });
        }
    });

    // Switch Layout
    body.delegate('keydown', '[data-switch]', function(event, element){
        var key = (event.which ? event.which : event.keyCode);
        if (key == 32 || key == 13) { // ARIA support: Space toggle
            event.preventDefault();
            body.emit('mousedown', event);
        }
    });

    body.delegate('mousedown', '[data-switch]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }

        // it's already loading something.
        if (element.parent('.g5-popover-content').find('[data-switch] i')) {
            return false;
        }

        element.showIndicator();

        var preset = $('[data-lm-preset]'),
            checkbox = element.parent('.g-pane').find('input[type="checkbox"][data-g-preserve]'),
            preserve = checkbox && checkbox.checked(),
            method = !preserve ? 'get' : 'post',
            data = {};

        if (preserve) {
            var lm = layoutmanager;
            lm.singles('cleanup', lm.builder, true);
            lm.savestate.setSession(lm.builder.serialize(null, true));

            data.preset = preset && preset.data('lm-preset') ? preset.data('lm-preset') : 'default';
            data.layout = JSON.stringify(lm.builder.serialize());
        }

        var uri = parseAjaxURI(element.data('switch') + getAjaxSuffix());
        request(method, uri, data, function(error, response) {
            element.hideIndicator();

            if (!response.body.success) {
                modal.open({
                    content: response.body.html || response.body,
                    afterOpen: function(container) {
                        if (!response.body.html) { container.style({ width: '90%' }); }
                    }
                });
                return;
            }

            if (response.body.message && !flags.get('lm:switcher:' + window.btoa(uri), false)) {
                // confirm before proceeding
                flags.warning({
                    message: response.body.message,
                    callback: function(response, content) {
                        var confirm = content.find('[data-g-delete-confirm]'),
                            cancel  = content.find('[data-g-delete-cancel]');

                        if (!confirm) { return; }

                        confirm.on('click', function(e) {
                            e.preventDefault();
                            if (this.attribute('disabled')) { return false; }

                            flags.get('lm:switcher:' + window.btoa(uri), true);
                            $([confirm, cancel]).attribute('disabled');
                            body.emit('mousedown', { target: element });

                            modal.close();
                        });

                        cancel.on('click', function(e) {
                            e.preventDefault();
                            if (this.attribute('disabled')) { return false; }

                            $([confirm, cancel]).attribute('disabled');
                            flags.get('lm:switcher:' + window.btoa(uri), false);

                            modal.close();
                            if (SWITCHER_HIT) {
                                setTimeout(function(){
                                    SWITCHER_HIT.getPopover().show();
                                }, 5);
                            }
                        });
                    }
                });

                return false;
            }

            var preset = response.body.preset || { name: 'default' },
                preset_name = response.body.title || 'Default',
                structure = response.body.data,
                notice = $('#lm-no-layout'),
                title = $('.layout-title .title small');

            root.data('lm-root', JSON.stringify(structure)).empty();
            root.data('lm-preset', preset);
            if (notice) { notice.style({ display: 'none' }); }
            if (title) { title.text('(' + preset_name + ')'); }
            builder.setStructure(structure);
            builder.load();

            lmhistory.push(builder.serialize(), JSON.parse(preset));

            $('[data-lm-switcher]').getPopover().hideAll().destroy();
        });
    });

    // Particles settings
    body.delegate('click', '[data-lm-settings]', function(event, element) {
        element = $(element);

        var blocktype = element.data('lm-blocktype'),
            settingsURL = element.data('lm-settings'),
            data = null, parent;

        // grid is a special case, since relies on pseudo elements for sorting and same width (evenize)
        // we need to check where the user clicked.
        if (blocktype === 'grid') {
            var clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0,
                boundings = element[0].getBoundingClientRect();

            if (clientX + 4 - boundings.left < boundings.width) {
                return false;
            }
        }

        element = element.parent('[data-lm-blocktype]');
        parent = element.parent('[data-lm-blocktype]');
        blocktype = element.data('lm-blocktype');

        var ID = element.data('lm-id'),
            parentID = parent ? parent.data('lm-id') : false,
            parentType = parent ? parent.data('lm-blocktype') : false;

        if (!contains(['block', 'grid'], blocktype)) {
            data = {};
            data.type = builder.get(element.data('lm-id')).getType() || element.data('lm-blocktype') || false;
            data.subtype = builder.get(element.data('lm-id')).getSubType() || element.data('lm-blocksubtype') || false;
            data.title = (element.find('h4') || element.find('.title')).text() || data.type || 'Untitled';
            data.options = builder.get(element.data('lm-id')).getAttributes() || {};
            data.block = parent && parentType !== 'wrapper' ? builder.get(parent.data('lm-id')).getAttributes() || {} : {};
            data.size_limits = builder.get(element.data('lm-id')).getLimits(!parent ? false : builder.get(parent.data('lm-id')));

            if (!data.type) { delete data.type; }
            if (!data.subtype) { delete data.subtype; }
            if (!size(data.options)) { delete data.options; }
            if (!size(data.block)) { delete data.block; }
        }

        modal.open({
            content: 'Loading',
            method: 'post',
            data: data,
            remote: parseAjaxURI(settingsURL + getAjaxSuffix()),
            remoteLoaded: function(response, content) {
                if (!response.body.success) { return; }

                var form = content.elements.content.find('form'),
                    fakeDOM = zen('div').html(response.body.html).find('form'),
                    submit = content.elements.content.search('input[type="submit"], button[type="submit"], [data-apply-and-save]'),
                    dataString = [], invalid = [];

                if ((!form && !fakeDOM) || !submit) { return true; }

                var urlTemplate = content.elements.content.find('.g-urltemplate');
                if (urlTemplate) { body.emit('input', { target: urlTemplate }); }

                var blockSize = content.elements.content.find('[name="block[size]"]');

                // logic for limits
                if (blockSize && data.size_limits) {
                    var note = content.elements.content.find('.blocksize-note'),
                        min = precision(data.size_limits[0], 1),
                        max = precision(data.size_limits[1], 1);

                    blockSize.attribute('min', min);
                    blockSize.attribute('max', max);

                    if (note) {
                        var noteHTML = note.html();
                        noteHTML = noteHTML.replace(/#min#/g, min);
                        noteHTML = noteHTML.replace(/#max#/g, max);

                        note.html(noteHTML);
                        note.find('.blocksize-' + (min == max ? 'range' : 'fixed')).addClass('hidden');
                    }

                    var isValid = function() {
                        return parseFloat(blockSize.value()) >= min && parseFloat(blockSize.value()) <= max ? '' : 'You need to stay in between the min and max range';
                    };

                    blockSize.on('input', function(){
                        blockSize[0].setCustomValidity(isValid());
                    });
                }

                // Particle Settings apply
                submit.on('click', function(e) {
                    e.preventDefault();

                    var target = $(e.target);

                    dataString = [];
                    invalid = [];

                    target.hideIndicator();
                    target.showIndicator();

                    $(fakeDOM[0].elements).forEach(function(input) {
                        input = $(input);
                        var name = input.attribute('name');
                        if (!name || input.disabled()) { return; }

                        input = content.elements.content.find('[name="' + name + '"]');
                        var value = input.type() == 'checkbox' ? Number(input.checked()) : input.value(),
                            parent = input.parent('.settings-param'),
                            override = parent ? parent.find('> input[type="checkbox"]') : null;

                        override = override || $(input.data('override-target'));

                        if (override && !override.checked()) { return; }
                        if (!validateField(input)) { invalid.push(input); }

                        dataString.push(name + '=' + encodeURIComponent(value));
                    });

                    var title = content.elements.content.find('[data-title-editable]');
                    if (title) {
                        dataString.push('title=' + encodeURIComponent(trim(title.data('title-editable'))));
                    }

                    if (invalid.length) {
                        target.hideIndicator();
                        target.showIndicator('fa fa-fw fa-exclamation-triangle');
                        toastr.error('Please review the fields in the modal and ensure you correct any invalid one.', 'Invalid Fields');
                        return;
                    }

                    request(fakeDOM.attribute('method'), parseAjaxURI(fakeDOM.attribute('action') + getAjaxSuffix()), dataString.join('&') || {}, function(error, response) {
                        if (!response.body.success) {
                            modal.open({
                                content: response.body.html || response.body,
                                afterOpen: function(container) {
                                    if (!response.body.html) { container.style({ width: '90%' }); }
                                }
                            });
                        } else {
                            var particle = builder.get(ID),
                                block = null;

                            // particle attributes
                            particle.setAttributes(response.body.data.options);

                            if (particle.hasAttribute('enabled')) { particle[particle.getAttribute('enabled') ? 'enable' : 'disable'](); }

                            if (particle.getType() != 'section') {
                                particle.setTitle(response.body.data.title || 'Untitled');
                                particle.updateTitle(particle.getTitle());
                            }

                            if (particle.getType() == 'position') {
                                particle.updateKey();
                            }

                            // parent block attributes
                            if (response.body.data.block && size(response.body.data.block)) {
                                block = builder.get(parentID);

                                var sibling = block.block.nextSibling() || block.block.previousSibling(),
                                    currentSize = block.getSize(),
                                    diffSize;

                                block.setAttributes(response.body.data.block);

                                diffSize = currentSize - block.getSize();

                                block.setAnimatedSize(block.getSize());

                                if (sibling) {
                                    sibling = builder.get(sibling.data('lm-id'));
                                    sibling.setAnimatedSize(parseFloat(sibling.getSize()) + diffSize, true);
                                }
                            }

                            lmhistory.push(builder.serialize(), lmhistory.get().preset);

                            // if it's apply and save we also save the panel
                            if (target.data('apply-and-save') !== null) {
                                var save = $('body').find('.button-save');
                                if (save) { body.emit('click', { target: save }); }
                            }

                            modal.close();

                            toastr.success('The particle "' + particle.getTitle() + '" settings have been applied to the Layout. <br />Remember to click the Save button to store them.', 'Settings Applied');
                        }

                        target.hideIndicator();
                    });
                });
            }
        });

    });

});

module.exports = {
    $: $,
    builder: builder,
    layoutmanager: layoutmanager,
    history: lmhistory,
    savestate: savestate
};

},{"../ui":49,"../ui/popover":51,"../utils/field-validation":62,"../utils/flags-state":63,"../utils/get-ajax-suffix":64,"../utils/get-ajax-url":65,"../utils/history":68,"../utils/save-state":70,"./builder":21,"./history":23,"./layoutmanager":26,"./particles-sidebar":27,"agent":71,"elements/attributes":98,"elements/domready":101,"elements/zen":106,"mout/array/contains":135,"mout/collection/forEach":156,"mout/collection/size":158,"mout/number/enforcePrecision":190,"mout/string/properCase":229,"mout/string/replace":232,"mout/string/trim":237}],26:[function(require,module,exports){
"use strict";
var prime      = require('prime'),
    $          = require('../utils/elements.utils'),
    bind       = require('mout/function/bind'),
    zen        = require('elements/zen'),
    Emitter    = require('prime/emitter'),
    Bound      = require('prime-util/prime/bound'),
    Options    = require('prime-util/prime/options'),
    Blocks     = require('./blocks'),
    DragDrop   = require('../ui/drag.drop'),
    Eraser     = require('../ui/eraser'),
    flags      = require('../utils/flags-state'),
    Resizer    = require('./drag.resizer'),
    get        = require('mout/object/get'),
    keys       = require('mout/object/keys'),

    every      = require('mout/array/every'),
    precision  = require('mout/number/enforcePrecision'),
    isArray    = require('mout/lang/isArray'),
    deepEquals = require('mout/lang/deepEquals'),
    find       = require('mout/collection/find'),
    isObject   = require('mout/lang/isObject');

var singles = {
    disable: function() {
        var grids = $('[data-lm-root] [data-lm-blocktype="grid"]');
        if (grids) { grids.removeClass('no-hover'); }
    },
    enable: function() {
        var grids = $('[data-lm-root] [data-lm-blocktype="grid"]');
        if (grids) { grids.addClass('no-hover'); }
    },
    cleanup: function(builder, dropLast) {
        var emptyGrids = $('[data-lm-blocktype="section"] > .g-grid:empty, [data-lm-blocktype="container"] > .g-grid:empty, [data-lm-blocktype="offcanvas"] > .g-grid:empty');
        if (emptyGrids) {
            emptyGrids.forEach(function(grid) {
                grid = $(grid);
                // empty grids should go away unless they are last and/or dropLast is true
                if (grid.nextSibling('[data-lm-id]') || dropLast) {
                    builder.remove(grid.data('lm-id'));
                    grid.remove();
                }
            });
        }
    }

};

var LayoutManager = new prime({

    mixin: [Bound, Options],
    inherits: Emitter,

    options: {},

    constructor: function(element, options) {
        this.setOptions(options);
        this.refElement = element;

        if (!element || !$(element)) { return; }

        this.init(element);
    },

    init: function() {
        this.dragdrop = new DragDrop(this.refElement, this.options);
        this.resizer = new Resizer(this.refElement, this.options);
        this.eraser = new Eraser('[data-lm-eraseblock]', this.options);
        this.dragdrop
            .on('dragdrop:start', this.bound('start'))
            .on('dragdrop:location', this.bound('location'))
            .on('dragdrop:nolocation', this.bound('nolocation'))
            .on('dragdrop:resize', this.bound('resize'))
            .on('dragdrop:stop:erase', this.bound('removeElement'))
            .on('dragdrop:stop', this.bound('stop'))
            .on('dragdrop:stop:animation', this.bound('stopAnimation'));

        this.builder = this.options.builder;
        this.history = this.options.history;
        this.savestate = this.options.savestate || null;

        singles.disable();
    },

    refresh: function() {
        if (!this.refElement || !$(this.refElement)) { return; }
        this.init();
    },

    singles: function(mode, builder, dropLast) {
        singles[mode](builder, dropLast);
    },

    updatePendingChanges: function() {
        var saveData   = this.savestate.getData(),
            serialData = this.builder.serialize(null, true),
            different  = false,

            equals     = deepEquals(saveData, serialData),
            save       = $('[data-save="Layout"]'),
            icon       = save.find('i'),
            indicator  = save.find('.changes-indicator');

        if (equals && indicator) { save.hideIndicator(); }
        if (!equals && !indicator) { save.showIndicator('changes-indicator fa fa-fw fa-circle-o') }
        flags.set('pending', !equals);

        // Emits the changed event for all particles
        // Used for UI to show particles where there have been differences applied
        // After a saved state
        var saved, current, id;
        serialData.forEach(function(block) {
            id = keys(block)[0];
            saved = find(saveData, function(data) { return data[id]; });
            current = find(serialData, function(data) { return data[id]; });
            different = !deepEquals(saved, current);

            id = this.builder.get(id);
            if (id) { id.emit('changed', different); }
        }, this);
    },

    start: function(event, element) {
        var root = $('[data-lm-root]'),
            size = $(element).position();

        this.block = null;
        this.mode = root.data('lm-root') || 'page';

        root.addClass('moving');

        var type  = $(element).data('lm-blocktype'),
            clone = element[0].cloneNode(true);

        if (!this.placeholder) { this.placeholder = zen('div.block.placeholder[data-lm-placeholder]'); }
        this.placeholder.style({ display: 'none' });

        clone = $(clone);
        this.original = clone.after(element).style({
            display: clone.hasClass('g-grid') ? 'flex' : 'block',
            opacity: 0.5
        }).addClass('original-placeholder').data('lm-dropzone', null);

        if (type === 'grid') { this.original.style({ display: 'flex' }); }

        this.originalType = type;

        this.block = get(this.builder.map, element.data('lm-id') || '') || new Blocks[type]({
                builder: this.builder,
                subtype: element.data('lm-subtype'),
                title: element.text()
            });

        if (!this.block.isNew()) {
            element.style({
                position: 'absolute',
                zIndex: 1500,
                opacity: 0.5,
                margin: 0,
                width: Math.ceil(size.width),
                height: Math.ceil(size.height)
            }).find('[data-lm-blocktype]');

            if (this.block.getType() === 'grid') {
                var siblings = this.block.block.siblings(':not(.original-placeholder):not(.section-header):not(:empty)');
                if (siblings) {
                    siblings.search('[data-lm-id]').style({ 'pointer-events': 'none' });
                }
            }

            this.placeholder.before(element);
            this.eraser.show();
        } else {
            var position = element.position();
            this.original.style({
                position: 'fixed',
                opacity: 0.5
            }).style({
                left: element[0].getBoundingClientRect().left,
                top: element[0].getBoundingClientRect().top,
                width: position.width,
                height: position.height
            });
            this.element = this.dragdrop.element;
            this.dragdrop.element = this.original;
        }

        var blocks;
        if (type === 'grid' && (blocks = root.search('[data-lm-dropzone]:not([data-lm-blocktype="grid"])'))) {
            blocks.style({ 'pointer-events': 'none' });
        }

        singles.enable();
    },

    location: function(event, location, target/*, element*/) {
        target = $(target);
        (!this.block.isNew() ? this.original : this.element).style({ transform: 'translate(0, 0)' });
        if (!this.placeholder) { this.placeholder = zen('div.block.placeholder[data-lm-placeholder]').style({ display: 'none' }); }

        var position,
            dataType     = target.data('lm-blocktype'),
            originalType = this.block.getType();

        if (!dataType && target.data('lm-root')) { dataType = 'root'; }
        if (this.mode !== 'page' && dataType === 'section') { return; }
        if (dataType === 'grid' && (target.parent().data('lm-root') || (target.parent().data('lm-blocktype') === 'container' && target.parent().parent().data('lm-root')))) { return; }

        // Check for adjacents and avoid inserting any placeholder since it would be the same position
        var exclude   = ':not(.placeholder):not([data-lm-id="' + this.original.data('lm-id') + '"])',
            adjacents = {
                before: this.original.previousSiblings(exclude),
                after: this.original.nextSiblings(exclude)
            };

        if (adjacents.before) { adjacents.before = $(adjacents.before[0]); }
        if (adjacents.after) { adjacents.after = $(adjacents.after[0]); }

        if (dataType === 'block' && ((adjacents.before === target && location.x === 'after') || (adjacents.after === target && location.x === 'before'))) {
            return;
        }
        if (dataType === 'grid' && ((adjacents.before === target && location.y === 'below') || (adjacents.after === target && location.y === 'above'))) {
            return;
        }

        var nonVisible = target.parent('[data-lm-blocktype="atoms"]'),
            child      = this.block.block.find('[data-lm-id]');

        if ((child ? child.data('lm-blocktype') : originalType) == 'atom') {
            if (!nonVisible) { return; }
        } else {
            if (nonVisible) { return; }
        }

        // handles the types cases and normalizes the locations (x and y)
        var grid, block, method;

        switch (dataType) {
            case 'root':
            case 'section':
                break;
            case 'grid':
                var empty = !target.children(':not(.placeholder)');
                // new particles cannot be dropped in existing grids, only empty ones
                if (originalType !== 'grid' && !empty) { return; }


                if (empty) {
                    if (originalType === 'grid') {
                        this.placeholder.before(target);
                    } else {
                        // we are dropping a new particle into an empty grid, placeholder goes inside
                        this.placeholder.bottom(target);
                    }
                } else {
                    // we are sorting grids ordering, placeholder goes above/below
                    method = (location.y === 'above' ? 'before' : 'after');
                    this.placeholder[method](target);
                }

                break;
            case 'block':
                method = (location.y === 'above' ? 'top' : 'bottom');
                position = (location.x === 'other') ? method : location.x;
                this.placeholder[position](target);

                break;
        }

        // If it's not a block we don't want a small version of the placeholder
        this.placeholder.removeClass('in-between').removeClass('in-between-grids').removeClass('in-between-grids-first').removeClass('in-between-grids-last');
        this.placeholder.style({ display: 'block' })[dataType !== 'block' ? 'removeClass' : 'addClass']('in-between');

        if (originalType === 'grid' && dataType === 'grid') {
            var next     = this.placeholder.nextSibling(),
                previous = this.placeholder.previousSibling();

            this.placeholder.addClass('in-between-grids');
            if (previous && !previous.data('lm-blocktype')) { this.placeholder.addClass('in-between-grids-first'); }
            if (!next || !next.data('lm-blocktype')) { this.placeholder.addClass('in-between-grids-last'); }
        }
    },

    nolocation: function(event) {
        (!this.block.isNew() ? this.original : this.element).style({ transform: 'translate(0, 0)' });
        if (this.placeholder) { this.placeholder.remove(); }
        if (!this.block) { return; }

        var target = event.type.match(/^touch/i) ? document.elementFromPoint(event.touches.item(0).clientX, event.touches.item(0).clientY) : event.target;

        if (!this.block.isNew()) {
            target = $(target);
            if (target.matches(this.eraser.element) || this.eraser.element.find(target)) {
                this.dragdrop.removeElement = true;
                this.eraser.over();
            } else {
                this.dragdrop.removeElement = false;
                this.eraser.out();
            }
        }
    },

    resize: function(event, element, siblings, offset) {
        this.resizer.start(event, element, siblings, offset);
    },

    removeElement: function(event, element) {
        this.dragdrop.removeElement = false;

        var transition = {
            opacity: 0
        };

        element.animate(transition, {
            duration: '150ms'
        });

        var root = $('[data-lm-root]'), blocks;
        if (this.block.getType() === 'grid' && (blocks = root.search('[data-lm-dropzone]:not([data-lm-blocktype="grid"])'))) {
            blocks.style({ 'pointer-events': 'inherit' });
        }

        var siblings = this.block.block.siblings(':not(.original-placeholder)');

        if (siblings && this.block.getType() == 'block') {
            var size                  = this.block.getSize(),
                diff                  = size / siblings.length,
                newSize, block, total = 0, last;
            siblings.forEach(function(sibling, index) {
                sibling = $(sibling);
                block = get(this.builder.map, sibling.data('lm-id'));
                if (index + 1 == siblings.length) { last = block; }
                newSize = precision(block.getSize() + diff, 0);
                total += newSize;
                block.setSize(newSize, true);
            }, this);

            // ensuring it's always 100%
            if (total != 100 && last) {
                size = last.getSize();
                diff = 100 - total;
                last.setSize(size + diff, true);
            }
        }

        this.eraser.hide();

        this.dragdrop.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
            $('body').off(event, this.dragdrop.bound('move'));
        }, this));

        this.dragdrop.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
            $('body').off(event, this.dragdrop.bound('deferStop'));
        }, this));

        this.builder.remove(this.block.getId());

        var children = this.block.block.search('[data-lm-id]');
        if (children && children.length) {
            children.forEach(function(child) {
                this.builder.remove($(child).data('lm-id'));
            }, this);
        }

        this.block.block.remove();

        if (this.placeholder) { this.placeholder.remove(); }
        if (this.original) { this.original.remove(); }
        this.element = this.block = null;

        singles.disable();
        singles.cleanup(this.builder);

        this.history.push(this.builder.serialize(), this.history.get().preset);
        root.removeClass('moving');

    },

    stop: function(event, target/*, element*/) {
        // we are removing the block
        var lastOvered = $(this.dragdrop.lastOvered);
        if (lastOvered && lastOvered.matches(this.eraser.element.find('.trash-zone'))) {
            this.eraser.hide();
            return;
        }

        if (this.block.getType() === 'grid') {
            var siblings = this.block.block.siblings(':not(.original-placeholder):not(.section-header):not(:empty)');
            if (siblings) {
                siblings.search('[data-lm-id]').style({ 'pointer-events': 'inherit' });
            }
        }

        if (!this.block.isNew()) { this.eraser.hide(); }
        if (!this.dragdrop.matched) {
            if (this.placeholder) { this.placeholder.remove(); }

            return;
        }

        target = $(target);

        var wrapper, insider,
            multiLocationResize = false,
            blockWasNew         = this.block.isNew(),
            type                = this.block.getType(),
            targetId            = target.data('lm-id'),
            targetType          = !targetId ? false : get(this.builder.map, targetId) ? get(this.builder.map, targetId).getType() : target.data('lm-blocktype'),
            placeholderParent   = this.placeholder.parent();

        if (!placeholderParent) { return; }

        var parentId   = placeholderParent.data('lm-id'),
            parentType = get(this.builder.map, parentId || '') ? get(this.builder.map, parentId).getType() : false,
            resizeCase = false;

        this.original.remove();

        // case 1: it's a new particle dropped in the LM, we need to wrap it inside a block
        if (type !== 'block' && type !== 'grid' && ((targetType === 'section' || targetType === 'grid') || (targetType === 'block' && parentType !== 'block'))) {
            wrapper = new Blocks.block({
                builder: this.builder
            }).adopt(this.block.block);

            insider = new Blocks[type]({
                id: this.block.block.data('lm-id'),
                type: type,
                subtype: this.element.data('lm-blocksubtype'),
                title: this.element.text(),
                builder: this.builder
            }).setLayout(this.block.block);

            wrapper.setSize();

            this.block = wrapper;
            this.builder.add(wrapper);
            this.builder.add(insider);

            insider.emit('rendered', insider, wrapper);
            wrapper.emit('rendered', wrapper, null);

            resizeCase = { case: 1 };
        }

        // case 2: moving a block around, need to fix sizes if it's a multi location resize
        if (this.originalType === 'block' && this.block.getType() === 'block') {
            resizeCase = { case: 3 };
            var previous            = this.block.block.parent('[data-lm-blocktype="grid"]'),
                placeholderPrevious = this.placeholder.parent('[data-lm-blocktype="grid"]');
            //if (previous.find('!> [data-lm-blocktype="container"]')) { previous = previous.parent(); }
            //if (placeholderPrevious.find('!> [data-lm-blocktype="container"]')) { placeholderPrevious = placeholderPrevious.parent(); }
            if (placeholderPrevious !== previous) {
                multiLocationResize = {
                    from: this.block.block.siblings(':not(.placeholder)'),
                    to: this.placeholder.siblings(':not(.placeholder)')
                };
            }

            if (previous.find('!> [data-lm-blocktype="container"]')) { previous = previous.parent(); }
            previous = previous.siblings(':not(.original-placeholder)');
            if (!this.block.isNew() && previous.length) { this.resizer.evenResize(previous); }

            this.block.block.attribute('style', null);
            this.block.setSize();
        }

        if (type === 'grid' && !siblings) {
            var plus = this.block.block.parent('[data-lm-blocktype="section"]').find('.fa-plus');
            if (plus) { plus.emit('click'); }
        }

        if (this.block.hasAttribute('size') && typeof this.block.getSize === 'function') { this.block.setSize(this.placeholder.compute('flex')); }

        this.block.insert(this.placeholder);
        this.placeholder.remove();

        if (blockWasNew) {
            if (resizeCase) { this.resizer.evenResize($([this.block.block, this.block.block.siblings()])); }

            this.element.attribute('style', null);
        }


        if (multiLocationResize.from || (multiLocationResize.to && multiLocationResize.to != this.block.block)) {
            // if !from / !to means it's empty grid, should we remove it?
            var size = this.block.getSize(), diff, block;

            // we are moving the particle to an empty grid, resetting the size to 100%
            if (!multiLocationResize.to) { this.block.setSize(100, true); }

            // we need to compensate the remaining blocks on the FROM with the leaving particle size
            if (multiLocationResize.from) {
                diff = size / multiLocationResize.from.length;
                var total = 0, curSize;
                multiLocationResize.from.forEach(function(sibling) {
                    sibling = $(sibling);
                    block = get(this.builder.map, sibling.data('lm-id'));
                    curSize = block.getSize() + diff;
                    block.setSize(curSize, true);
                    total += curSize;
                }, this);

                if (total !== 100) {
                    diff = (100 - total) / multiLocationResize.from.length;
                    multiLocationResize.from.forEach(function(sibling) {
                        sibling = $(sibling);
                        block = get(this.builder.map, sibling.data('lm-id'));
                        curSize = block.getSize() + diff;
                        block.setSize(curSize, true);
                    }, this);
                }
            }

            // the TO is receiving a new block so we are going to evenize
            if (multiLocationResize.to) {
                size = 100 / (multiLocationResize.to.length + 1);
                multiLocationResize.to.forEach(function(sibling) {
                    sibling = $(sibling);
                    block = get(this.builder.map, sibling.data('lm-id'));
                    block.setSize(size, true);
                }, this);
                this.block.setSize(size, true);
            }
        }

        singles.disable();
        singles.cleanup(this.builder);

        this.history.push(this.builder.serialize(), this.history.get().preset);
    },

    stopAnimation: function(element) {
        var root = $('[data-lm-root]');
        root.removeClass('moving');

        if (this.original) { this.original.remove(); }
        singles.disable();

        if (!this.block) { this.block = get(this.builder.map, element.data('lm-id')); }
        if (this.block && this.block.getType() === 'block') { this.block.setSize(); }
        if (this.block && this.block.isNew() && this.element) { this.element.attribute('style', null); }

        if (this.originalType === 'grid') {
            var blocks, block;
            if (blocks = root.search('[data-lm-dropzone]:not([data-lm-blocktype="grid"])')) {
                blocks.forEach(function(element) {
                    element = $(element);
                    block = get(this.builder.map, element.data('lm-id'));
                    element.attribute('style', null);
                    block.setSize();
                }, this);
            }
        }
    }
});

module.exports = LayoutManager;

},{"../ui/drag.drop":46,"../ui/eraser":48,"../utils/elements.utils":60,"../utils/flags-state":63,"./blocks":13,"./drag.resizer":22,"elements/zen":106,"mout/array/every":138,"mout/collection/find":155,"mout/function/bind":159,"mout/lang/deepEquals":169,"mout/lang/isArray":171,"mout/lang/isObject":176,"mout/number/enforcePrecision":190,"mout/object/get":199,"mout/object/keys":202,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266}],27:[function(require,module,exports){
"use strict";

var ready          = require('elements/domready'),
    $              = require('elements'),
    decouple       = require('../utils/decouple'),
    scrollbarWidth = require('../utils/get-scrollbar-width');

var container, sidebar, search, particles, height, heightTop, heightBottom, excludeTop, excludeBottom,
    initialSidebarCoords, realSidebarTop;

var initSizes = function() {
    // fixed and contained particles sidebar
    container = $('.sidebar-block');
    if (!container) { return; }

    sidebar = container.find('.g5-lm-particles-picker');
    if (!sidebar) { return; }

    search = sidebar.find('> .search');
    particles = sidebar.find('> .particles-container');
    height = window.innerHeight;
    heightTop = 0;
    heightBottom = 0;
    initialSidebarCoords = sidebar[0].getBoundingClientRect();
    realSidebarTop = sidebar.position().top;
    excludeTop = $('body.admin.com_gantry5 nav.navbar-fixed-top, #wpadminbar, #admin-main #titlebar, #admin-main .grav-update.grav');
    excludeBottom = $('body.admin.com_gantry5 #status');

    if (excludeTop) {
        $(excludeTop).forEach(function(element) {
            heightTop += element.offsetHeight;
        });
    }

    if (excludeBottom) {
        $(excludeBottom).forEach(function(element) {
            heightBottom += element.offsetHeight;
        });
    }

    particles.style({
        'max-height': (height - heightTop - heightBottom - search[0].offsetHeight - 30),
        overflow: 'auto'
    });

    if (particles[0].scrollHeight != particles[0].offsetHeight) {
        particles.addClass('has-scrollbar').style({ 'margin-right': -scrollbarWidth() });
    }
};

ready(function() {
    initSizes();

    var scrollElement = $(GANTRY_PLATFORM == 'grav' ? '#admin-main .content-padding' : window) || [window];

    decouple(scrollElement[0], 'scroll', function() {
        if (!container || !sidebar) { return; }

        var scrollTop       = this.scrollY || this.scrollTop,
            containerBounds = container[0].getBoundingClientRect(),
            limit           = containerBounds.top + containerBounds.height,
            sidebarCoords   = sidebar[0].getBoundingClientRect(),
            shouldBeFixed   = (scrollTop > (initialSidebarCoords.top - heightTop - 10)) && scrollTop >= realSidebarTop - 10,
            reachedTheLimit = sidebarCoords.height + 10 + heightTop + parseInt(container.compute('padding-bottom'), 10) >= limit;

        sidebar.style('width', sidebarCoords.width);
        if (shouldBeFixed && !reachedTheLimit) {
            sidebar.removeClass('particles-absolute').addClass('particles-fixed');
            sidebar.style({
                top: heightTop + 10,
                bottom: 'inherit'
            });
        } else if (shouldBeFixed && reachedTheLimit) {
            sidebar.removeClass('particles-fixed').addClass('particles-absolute');
            sidebar.style({
                top: 'inherit',
                bottom: parseInt(container.compute('padding-bottom'), 10)
            });
        } else {
            sidebar.removeClass('particles-fixed').removeClass('particles-absolute');
            sidebar.style({
                top: 'inherit',
                bottom: 'inherit'
            });
        }
    });

    decouple(window, 'resize', function() {
        if (!particles) { return; }

        sidebar.style('width', null);
        initSizes();

        particles.style({
            'max-height': (window.innerHeight - heightTop - heightBottom - search[0].offsetHeight - 30)
        });
    });

    $('body').on('statechangeEnd', function() {
        initSizes();
    });
});

module.exports = initSizes;

},{"../utils/decouple":59,"../utils/get-scrollbar-width":66,"elements":103,"elements/domready":101}],28:[function(require,module,exports){
"use strict";
var $              = require('elements'),
    zen            = require('elements/zen'),
    ready          = require('elements/domready'),
    request        = require('agent'),
    ui             = require('./ui'),
    interpolate    = require('mout/string/interpolate'),
    trim           = require('mout/string/trim'),
    setParam       = require('mout/queryString/setParam'),
    modal          = ui.modal,
    toastr         = ui.toastr,

    parseAjaxURI   = require('./utils/get-ajax-url').parse,
    getAjaxURL     = require('./utils/get-ajax-url').global,
    getAjaxSuffix  = require('./utils/get-ajax-suffix'),

    flags          = require('./utils/flags-state'),
    validateField  = require('./utils/field-validation'),
    lm             = require('./lm'),
    mm             = require('./menu'),
    configurations = require('./configurations'),
    positions      = require('./positions'),
    changelog      = require('./changelog');

require('elements/attributes');
require('elements/events');
require('elements/delegation');
require('elements/insertion');
require('elements/traversal');
require('./fields');
require('./ui/popover');
require('./utils/ajaxify-links');
require('./utils/rAF-polyfill');

var createHandler = function(divisor, noun, restOfString) {
    return function(diff) {
        var n = Math.floor(diff / divisor);
        var pluralizedNoun = noun + ( n > 1 ? 's' : '' );
        return "" + n + " " + pluralizedNoun + " " + restOfString;
    }
};

var formatters = [
    { threshold: -31535999, handler: createHandler(-31536000,	"year",     "from now" ) },
    { threshold: -2591999, 	handler: createHandler(-2592000,  	"month",    "from now" ) },
    { threshold: -604799,  	handler: createHandler(-604800,   	"week",     "from now" ) },
    { threshold: -172799,   handler: createHandler(-86400,    	"day",      "from now" ) },
    { threshold: -86399,   	handler: function(){ return      	"tomorrow" } },
    { threshold: -3599,    	handler: createHandler(-3600,     	"hour",     "from now" ) },
    { threshold: -59,     	handler: createHandler(-60,       	"minute",   "from now" ) },
    { threshold: -0.9999,   handler: createHandler(-1,			"second",   "from now" ) },
    { threshold: 1,        	handler: function(){ return      	"just now" } },
    { threshold: 60,       	handler: createHandler(1,        	"second",	"ago" ) },
    { threshold: 3600,     	handler: createHandler(60,       	"minute",	"ago" ) },
    { threshold: 86400,    	handler: createHandler(3600,     	"hour",     "ago" ) },
    { threshold: 172800,   	handler: function(){ return      	"yesterday" } },
    { threshold: 604800,   	handler: createHandler(86400,    	"day",      "ago" ) },
    { threshold: 2592000,  	handler: createHandler(604800,   	"week",     "ago" ) },
    { threshold: 31536000, 	handler: createHandler(2592000,  	"month",    "ago" ) },
    { threshold: Infinity, 	handler: createHandler(31536000, 	"year",     "ago" ) }
];

var prettyDate = {
    format: function(date) {
        var diff = (((new Date()).getTime() - date.getTime()) / 1000);
        for (var i = 0; i < formatters.length; i++) {
            if (diff < formatters[i].threshold) {
                return formatters[i].handler(diff);
            }
        }
        throw new Error("exhausted all formatter options, none found"); //should never be reached
    }
};

window.onbeforeunload = function() {
    if (flags.get('pending')) {
        return 'You haven\'t saved your changes and by leaving the page they will be lost.\nDo you want to leave without saving?';
    }
};

ready(function() {
    var body     = $('body'),
        sentence = 'The {{type}} {{verb}} been successfully saved! {{extras}}';

    // Close notification
    body.delegate('click', '[data-g-close]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }
        var parent = element.data('g-close');
        parent = parent ? element.parent(parent) : element;

        parent.slideUp(function() {
            parent.remove();
        });
    });

    // Extras
    body.delegate('click', '[data-g-extras]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }

        if (!element.PopoverDefined) {
            var content = element.find('[data-popover-content]') || element.siblings('[data-popover-content]'),
                popover = element.getPopover({
                    style: 'extras',
                    width: 220,
                    content: zen('ul').html(content.html())[0].outerHTML,
                    allowElementsClick: '.toggle'
                });
            element.on('shown.popover', function(popover){
                element.attribute('aria-expanded', true).attribute('aria-hidden', false);
                element.find('.enabler')[0].focus();
            });

            element.on('hide.popover', function(popover){
                element.attribute('aria-expanded', false).attribute('aria-hidden', true);
            });

            element.getPopover().show();
        }
    });

    // Platform Settings redirect
    body.delegate('mousedown', '[data-settings-key]', function(event, element) {
        var key = element.data('settings-key');
        if (!key) { return true; }

        var redirect = window.location.search,
            settings = element.attribute('href'),
            uri      = window.location.href.split('?');
        if (uri.length > 1 && uri[0].match(/index.php$/)) { redirect = 'index.php' + redirect; }

        redirect = setParam(settings, key, btoa(redirect));
        element.href(redirect);
    });

    // Save Tooltip
    body.delegate('mouseover', '.button-save', function(event, element) {
        if (!element.lastSaved) { return true; }
        var feedback = 'Last Saved: ' + prettyDate.format(element.lastSaved);
        element
            .data('tip', feedback)
            .data('title', feedback);
    });

    // Save
    body.delegate('click', '.button-save', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }
        var saves = $('.button-save');

        saves.hideIndicator();
        saves.showIndicator();

        var data    = {},
            invalid = [],
            type    = element.data('save'),
            extras  = '',
            page    = $('[data-lm-root]') ? 'layout' : ($('[data-mm-id]') ? 'menu' : 'other'),
            saveURL = parseAjaxURI(trim(window.location.href, '#') + getAjaxSuffix());

        switch (page) {
            case 'layout':
                var preset = $('[data-lm-preset]');
                lm.layoutmanager.singles('cleanup', lm.builder, true);
                lm.savestate.setSession(lm.builder.serialize(null, true));

                data.preset = preset && preset.data('lm-preset') ? preset.data('lm-preset') : 'default';
                data.layout = JSON.stringify(lm.builder.serialize());

                break;
            case 'menu':
                data.menutype = $('select.menu-select-wrap').value();
                data.settings = JSON.stringify(mm.menumanager.settings);
                data.ordering = JSON.stringify(mm.menumanager.ordering);
                data.items = JSON.stringify(mm.menumanager.items);

                saveURL = parseAjaxURI(element.parent('form').attribute('action') + getAjaxSuffix());
                break;

            case 'other':
            default:
                var form = element.parent('form');

                if (form && element.attribute('type') == 'submit') {
                    $(form[0].elements).forEach(function(input) {
                        input = $(input);
                        var name     = input.attribute('name'),
                            value    = input.value(),
                            parent   = input.parent('.settings-param, .card-overrideable'),
                            override = parent ? parent.find('> input[type="checkbox"]') : null;

                        override = override || $(input.data('override-target'));

                        if (!name || input.disabled() || (override && !override.checked())) { return; }
                        if (!validateField(input)) { invalid.push(input); }
                        data[name] = value;
                    });
                }
        }

        if (invalid.length) {
            saves.hideIndicator();
            saves.showIndicator('fa fa-fw fa-exclamation-triangle');
            toastr.error('Please review the fields in the page and ensure you correct any invalid one.', 'Invalid Fields');
            return;
        }

        if (page == 'other') { $('.settings-param-title, .card.settings-block > h4').hideIndicator(); }
        body.emit('updateOriginalFields');

        request('post', saveURL, data, function(error, response) {
            if (!response.body.success) {
                modal.open({
                    content: response.body.html || response.body,
                    afterOpen: function(container) {
                        if (!response.body.html) { container.style({ width: '90%' }); }
                    }
                });
            } else {
                modal.close();

                if ($('#styles')) {
                    extras = '<br />' + (response.body.warning ? '<hr />' + response.body.title + '<br />' + response.body.html : 'The CSS was successfully compiled!');
                }

                toastr[response.body.warning ? 'warning' : 'success'](interpolate(sentence, {
                    verb: type.slice(-1) == 's' ? 'have' : 'has',
                    type: type,
                    extras: extras
                }), type + ' Saved');
            }

            saves.hideIndicator();
            saves.forEach(function(save) {
                $(save).lastSaved = new Date();
            });

            if (page == 'layout') { lm.layoutmanager.updatePendingChanges(); }

            // all good, disable 'pending' flag
            flags.set('pending', false);
            flags.emit('update:pending');
        });
    });

    // Editable titles
    body.delegate('keydown', '[data-title-edit]', function(event, element) {
        var key = (event.which ? event.which : event.keyCode);
        if (key == 32 || key == 13) { // ARIA support: Space / Enter toggle
            event.preventDefault();
            body.emit('click', event);
        }
    });

    body.delegate('click', '[data-title-edit]', function(event, element) {
        element = $(element);
        if (element.hasClass('disabled')) { return false; }

        var $title = element.siblings('[data-title-editable]') || element.previousSiblings().find('[data-title-editable]') || element.nextSiblings().find('[data-title-editable]'), title;
        if (!$title) { return true; }

        title = $title[0];
        $title.text(trim($title.text()));

        $title.attribute('contenteditable', true);
        title.focus();

        var range = document.createRange(), selection;
        range.selectNodeContents(title);
        selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        $title.storedTitle = trim($title.text());
        $title.titleEditCanceled = false;
        $title.emit('title-edit-start', $title.storedTitle);
    });

    body.delegate('keydown', '[data-title-editable]', function(event, element) {
        element = $(element);
        switch (event.keyCode) {
            case 13: // return
            case 27: // esc
                event.stopPropagation();

                if (event.keyCode == 27) {
                    if (typeof element.storedTitle !== 'undefined') {
                        element.text(element.storedTitle);
                        element.titleEditCanceled = true;
                    }
                }

                element.attribute('contenteditable', null);
                element[0].blur();

                element.emit('title-edit-exit', element.data('title-editable'), event.keyCode == 13 ? 'enter' : 'esc');
                return false;
            default:
                return true;
        }
    });

    body.delegate('blur', '[data-title-editable]', function(event, element) {
        element = $(element);
        element[0].scrollLeft = 0;
        element.attribute('contenteditable', null);
        element.data('title-editable', trim(element.text()));
        window.getSelection().removeAllRanges();
        element.emit('title-edit-end', element.data('title-editable'), element.storedTitle, element.titleEditCanceled);
    }, true);

    // Quick Ajax Calls [data-ajax-action]
    body.delegate('click', '[data-ajax-action]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }

        var href      = element.attribute('href') || element.data('ajax-action'),
            method    = element.data('ajax-action-method') || 'post',
            indicator = $(element.data('ajax-action-indicator')) || element;

        if (!href) { return false; }

        indicator.showIndicator();
        request(method, parseAjaxURI(href + getAjaxSuffix()), function(error, response) {
            if (!response.body.success) {
                modal.open({
                    content: response.body.html || response.body,
                    afterOpen: function(container) {
                        if (!response.body.html) { container.style({ width: '90%' }); }
                    }
                });

                indicator.hideIndicator();
                return false;
            } else {
                toastr[response.body.warning ? 'warning' : 'success'](response.body.html || 'Action successfully completed.', response.body.title || '');
            }

            indicator.hideIndicator();
        })
    });

});

var modules = {
    /*mout    : require('mout'),
     prime   : require('prime'),
     "$"     : elements,
     zen     : zen,
     domready: domready,
     agent   : require('agent'),*/
    lm: lm,
    mm: mm,
    assingments: require('./assignments'),
    ui: require('./ui'),
    styles: require('./styles'),
    "$": $,
    domready: require('elements/domready'),
    particles: require('./particles'),
    zen: require('elements/zen'),
    moofx: require('moofx'),
    atoms: require('./pagesettings'),
    tips: require('./ui/tooltips')
};

window.G5 = modules;
module.exports = modules;

},{"./assignments":2,"./changelog":3,"./configurations":5,"./fields":6,"./lm":25,"./menu":31,"./pagesettings":33,"./particles":39,"./positions":43,"./styles":44,"./ui":49,"./ui/popover":51,"./ui/tooltips":56,"./utils/ajaxify-links":57,"./utils/field-validation":62,"./utils/flags-state":63,"./utils/get-ajax-suffix":64,"./utils/get-ajax-url":65,"./utils/rAF-polyfill":69,"agent":71,"elements":103,"elements/attributes":98,"elements/delegation":100,"elements/domready":101,"elements/events":102,"elements/insertion":104,"elements/traversal":105,"elements/zen":106,"moofx":107,"mout/queryString/setParam":215,"mout/string/interpolate":226,"mout/string/trim":237}],29:[function(require,module,exports){
"use strict";
var DragEvents = require('../ui/drag.events'),
    prime      = require('prime'),
    Emitter    = require('prime/emitter'),
    Bound      = require('prime-util/prime/bound'),
    Options    = require('prime-util/prime/options'),
    bind       = require('mout/function/bind'),
    isString   = require('mout/lang/isString'),
    nMap       = require('mout/math/map'),
    clamp      = require('mout/math/clamp'),
    precision  = require('mout/number/enforcePrecision'),
    get        = require('mout/object/get'),
    $          = require('../utils/elements.utils');

require('elements/events');
require('elements/delegation');

var Resizer = new prime({
    mixin: [Bound, Options],
    DRAG_EVENTS: DragEvents,
    options: {
        minSize: 5
    },
    constructor: function(container, options, menumanager) {
        this.setOptions(options);
        this.history = this.options.history || {};
        this.builder = this.options.builder || {};
        this.map = this.builder.map;
        this.menumanager = menumanager;
        this.origin = {
            x: 0,
            y: 0,
            transform: null,
            offset: {
                x: 0,
                y: 0
            }
        };
    },

    getBlock: function(element) {
        return get(this.map, isString(element) ? element : $(element).data('lm-id') || '');
    },

    getAttribute: function(element, prop) {
        return this.getBlock(element).getAttribute(prop);
    },

    getSize: function(element) {
        element = $(element);
        var parent = element.matches('[data-mm-id]') ? element : element.parent('[data-mm-id]'),
            size = parent.find('.percentage input');

        return Number(size.value());
    },

    setSize: function(element, size, animated) {
        element = $(element);
        animated = typeof animated === 'undefined' ? false : animated;

        var parent = element.matches('[data-mm-id]') ? element : element.parent('[data-mm-id]'),
            pc = parent.find('.percentage input');

        parent[animated ? 'animate' : 'style']({'flex': '0 1 '+size+'%'});
        pc.value(precision(size, 1));
    },

    start: function(event, element, siblings, offset) {
        if (event && event.type.match(/^touch/i)) { event.preventDefault(); }
        if (event.which && event.which !== 1) { return true; }

        // Stops text selection
        event.preventDefault();

        this.element = $(element);

        var parent = this.element.parent('.submenu-selector');
        if (!parent) { return false; }

        parent.addClass('moving');
        
        this.siblings = {
            occupied: 0,
            elements: siblings,
            next: this.element.parent('[data-mm-id]').nextSibling().find('> .submenu-column'),
            prevs: this.element.parent('[data-mm-id]').previousSiblings(),
            sizeBefore: 0
        };

        if (this.siblings.elements.length > 1) {
            this.siblings.occupied -= this.getSize(this.siblings.next);
            this.siblings.elements.forEach(function(sibling) {
                this.siblings.occupied += this.getSize(sibling);
            }, this);
        }

        if (this.siblings.prevs) {
            this.siblings.prevs.forEach(function(sibling) {
                this.siblings.sizeBefore += this.getSize(sibling);
            }, this);
        }

        this.origin = {
            size: this.getSize(this.element),
            maxSize: this.getSize(this.element) + this.getSize(this.siblings.next),
            x: event.changedTouches ? event.changedTouches[0].pageX : event.pageX + 6,
            y: event.changedTouches ? event.changedTouches[0].pageY : event.pageY
        };

        var clientRect = this.element[0].getBoundingClientRect(),
            parentRect = this.element.parent()[0].getBoundingClientRect();

        this.origin.offset = {
            clientRect: clientRect,
            parentRect: {left: parentRect.left, right: parentRect.right},
            x: this.origin.x - clientRect.right,
            y: clientRect.top - this.origin.y,
            down: offset
        };

        this.origin.offset.parentRect.left = this.element.parent('.submenu-selector').find('> [data-mm-id]:first-child')[0].getBoundingClientRect().left;
        this.origin.offset.parentRect.right = this.element.parent('.submenu-selector').find('> [data-mm-id]:last-child')[0].getBoundingClientRect().right;


        this.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
            $(document).on(event, this.bound('move'));
        }, this));

        this.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
            $(document).on(event, this.bound('stop'));
        }, this));
    },

    move: function(event) {
        if (event && event.type.match(/^touch/i)) { event.preventDefault(); }

        var clientX = event.clientX || event.touches[0].clientX || 0,
            clientY = event.clientY || event.touches[0].clientY || 0,
            parentRect = this.origin.offset.parentRect;

        var deltaX = (this.lastX || clientX) - clientX,
            deltaY = (this.lastY || clientY) - clientY;

        this.direction =
            Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0 && 'left' ||
            Math.abs(deltaX) > Math.abs(deltaY) && deltaX < 0 && 'right' ||
            Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0 && 'up' ||
                                                                 'down';
        var size,
            diff = 100 - this.siblings.occupied,
            value = clientX + (!this.siblings.prevs ? this.origin.offset.x - this.origin.offset.down : this.siblings.prevs.length),
            normalized = clamp(value, parentRect.left, parentRect.right);

        size = nMap(normalized, parentRect.left, parentRect.right, 0, 100);
        size = size - this.siblings.sizeBefore;
        size = precision(clamp(size, this.options.minSize, this.origin.maxSize - this.options.minSize), 0);

        diff = precision(diff - size, 0);

        this.setSize(this.element, size);
        this.setSize(this.siblings.next, diff);

        // Hack to handle cases where size is not an integer
        var siblings = this.siblings.elements,
            amount = siblings ? siblings.length + 1 : 1;
        if (amount == 3 || amount == 6 || amount == 7 || amount == 8 || amount == 9 || amount == 11 || amount == 12) {
            var total = 0, blocks;

            blocks = $([siblings, this.element.parent('[data-mm-id]')]);
            blocks.forEach(function(block, index){
                block = $(block);
                size = this.getSize(block);
                if (size % 1) {
                    size = precision(100 / amount, 0);
                    this.setSize(block, size);
                }

                total += size;

                if (blocks.length == index + 1 && total != 100) {
                    diff = 100 - total;
                    this.setSize(block, (size + diff));
                }

            }, this);
        }

        this.lastX = clientX;
        this.lastY = clientY;
    },

    stop: function(event) {
        if (event && event.type.match(/^touch/i)) { event.preventDefault(); }

        this.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
            $(document).off(event, this.bound('move'));
        }, this));

        this.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
            $(document).off(event, this.bound('stop'));
        }, this));

        this.element.parent('.submenu-selector').removeClass('moving');

        this.menumanager.emit('dragEnd', this.menumanager.map, 'resize');
        //if (this.origin.size !== this.getSize(this.element)) { this.history.push(this.builder.serialize()); }
    },

    updateItemSizes: function(elements) {
        var parent = this.element ? this.element.parent('.submenu-selector') : null;
        if (!parent && !elements) { return false; }

        var blocks = elements || parent.search('> [data-mm-id]'),
            sizes = [],
            active = $('.menu-selector .active'),
            path = active ? active.data('mm-id') : null;

        blocks.forEach(function(block){
            sizes.push(this.getSize(block));
        }, this);

        // update active path with new columns sizes
        this.menumanager.items[path].columns = sizes;

        this.updateMaxValues(elements);

        return sizes;
    },

    updateMaxValues: function(elements) {
        var parent = this.element ? this.element.parent('.submenu-selector') : null;
        if (!parent && !elements) { return false; }

        var blocks = elements || parent.search('> [data-mm-id]'), sizes, inputs;

        blocks.forEach(function(block){
            block = $(block);
            var sibling = block.nextSibling() || block.previousSibling();
            if (!sibling) { return; }

            inputs = {
                block: block.find('input.column-pc'),
                sibling: sibling.find('input.column-pc')
            };

            sizes = {
                current: this.getSize(block),
                sibling: this.getSize(sibling)
            };

            sizes.total = sizes.current + sizes.sibling;
            inputs.block.attribute('max', sizes.total - Number(inputs.block.attribute('min')));
            inputs.sibling.attribute('max', sizes.total - Number(inputs.sibling.attribute('min')));
        }, this);
    },

    evenResize: function(elements, animated) {
        var total = elements.length,
            size = precision(100 / total, 4);

        elements.forEach(function(element) {
            element = $(element);
            this.setSize(element, size, (typeof animated == 'undefined' ? false : animated));
        }, this);

        this.updateItemSizes(elements);
        this.menumanager.emit('dragEnd', this.menumanager.map, 'evenResize');
    }
});

module.exports = Resizer;

},{"../ui/drag.events":47,"../utils/elements.utils":60,"elements/delegation":100,"elements/events":102,"mout/function/bind":159,"mout/lang/isString":179,"mout/math/clamp":184,"mout/math/map":186,"mout/number/enforcePrecision":190,"mout/object/get":199,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266}],30:[function(require,module,exports){
"use strict";
var $             = require('elements'),
    zen           = require('elements/zen'),
    ready         = require('elements/domready'),
    modal         = require('../ui').modal,
    toastr        = require('../ui').toastr,
    request       = require('agent'),
    indexOf       = require('mout/array/indexOf'),
    trim          = require('mout/string/trim'),
    parseAjaxURI  = require('../utils/get-ajax-url').parse,
    getAjaxURL    = require('../utils/get-ajax-url').global,
    getAjaxSuffix = require('../utils/get-ajax-suffix'),
    flags         = require('../utils/flags-state'),
    deepEquals    = require('mout/lang/deepEquals');

var menumanager = null;

var randomID = function randomString(len, an) {
    an = an && an.toLowerCase();
    var str = "", i = 0, min = an == 'a' ? 10 : 0, max = an == 'n' ? 10 : 62;

    for (; i++ < len;) {
        var r = Math.random() * (max - min) + min << 0;
        str += String.fromCharCode(r += r > 9 ? r < 36 ? 55 : 61 : 48);
    }
    return str;
};

var StepOne = function(map, mode) { // mode [reorder, resize, evenResize]
    if (this.isNewParticle && mode !== 'reorder') { return; }
    this.resizer.updateItemSizes();

    menumanager = this;

    var save = $('[data-save]'),
        current = {
            settings: this.settings,
            ordering: this.ordering,
            items: this.items
        };

    if (!this.isNewParticle) {
        if (!deepEquals(map, current)) {
            save.showIndicator('fa fa-fw changes-indicator fa-circle-o');
            flags.set('pending', true);
        } else {
            save.hideIndicator();
            flags.set('pending', false);
        }
    }

    if (this.isParticle && this.isNewParticle) {
        var blocktype = this.block.data('mm-blocktype');
        this.block.attribute('data-mm-blocktype', null).addClass('g-menu-item-' + blocktype).data('mm-original-type', blocktype);
        zen('span.menu-item-type.badge').text(blocktype).after(this.block.find('.menu-item .title'));

        modal.open({
            content: 'Loading',
            method: 'post',
            //data: data,
            remote: parseAjaxURI($(this.block).find('.config-cog').attribute('href') + getAjaxSuffix()),
            remoteLoaded: function(response, modal) {
                var search = modal.elements.content.find('.search input'),
                    blocks = modal.elements.content.search('[data-mm-type]'),
                    filters = modal.elements.content.search('[data-mm-filter]');

                if (!search || !filters || !blocks) { return; }

                search.on('input', function() {
                    if (!this.value()) {
                        blocks.removeClass('hidden');
                        return;
                    }

                    blocks.addClass('hidden');

                    var found = [], value = this.value().toLowerCase(), text;

                    filters.forEach(function(filter) {
                        filter = $(filter);
                        text = trim(filter.data('mm-filter')).toLowerCase();
                        if (text.match(new RegExp("^" + value + '|\\s' + value, 'gi'))) {
                            found.push(filter.matches('[data-mm-type]') ? filter : filter.parent('[data-mm-type]'));
                        }
                    }, this);

                    if (found.length) { $(found).removeClass('hidden'); }
                });

                setTimeout(function(){
                    search[0].focus();
                }, 5);
            }
        });
    }

    this.type = undefined;
};

var StepTwo = function(data, content, button) {
    var uri = content.find('[data-mm-particle-stepone]').data('mm-particle-stepone'),
        picker = data.instancepicker,
        moduleType = {
            wordpress: 'widget',
            joomla: 'particle'
        };

    if (picker) {
        var item = JSON.parse(data.item);
        picker = JSON.parse(picker);
        delete(data.instancepicker);
        //uri = getAjaxURL(item.type + '/' + item[moduleType[GANTRY_PLATFORM]]);
        uri = getAjaxURL(item.type + '/' + item[item.type]);
    }

    request('post', parseAjaxURI(uri + getAjaxSuffix()), data, function(error, response) {
        if (!response.body.success) {
            modal.open({
                content: response.body.html || response.body,
                afterOpen: function(container) {
                    if (!response.body.html) { container.style({ width: '90%' }); }
                }
            });

            button.hideIndicator();

            return;
        }

        content.html(response.body.html);

        var selects = $('[data-selectize]');
        if (selects) { selects.selectize(); }

        var urlTemplate = content.find('.g-urltemplate');
        if (urlTemplate) { $('body').emit('input', { target: urlTemplate }); }

        var form = content.find('form'),
            submit = content.find('input[type="submit"], button[type="submit"]'),
            fakeDOM = zen('div').html(response.body.html).find('form'),
            dataString = [];

        if ((!form && !fakeDOM) || !submit) { return true; }

        var applyAndSave = content.search('[data-apply-and-save]');
        if (applyAndSave) { applyAndSave.remove(); }

        // Module / Particle Settings apply
        submit.on('click', function(e) {
            e.preventDefault();
            dataString = [];

            submit.showIndicator();

            $(fakeDOM[0].elements).forEach(function(input) {
                input = $(input);
                var name = input.attribute('name');
                if (!name || input.disabled()) { return; }

                input = content.find('[name="' + name + '"]');
                var value = input.type() == 'checkbox' ? Number(input.checked()) : input.value(),
                    parent = input.parent('.settings-param'),
                    override = parent ? parent.find('> input[type="checkbox"]') : null;

                override = override || $(input.data('override-target'));

                if (override && !override.checked()) { return; }
                if (input.type() != 'checkbox' || (input.type() == 'checkbox' && !!value)) {
                    dataString.push(name + '=' + encodeURIComponent(value));
                }
            });

            var title = content.find('[data-title-editable]');
            if (title) {
                dataString.push('title=' + encodeURIComponent(title.data('title-editable')));
            }

            request(fakeDOM.attribute('method'), parseAjaxURI(fakeDOM.attribute('action') + getAjaxSuffix()), dataString.join('&') || {}, function(error, response) {
                if (!response.body.success) {
                    modal.open({
                        content: response.body.html || response.body,
                        afterOpen: function(container) {
                            if (!response.body.html) { container.style({ width: '90%' }); }
                        }
                    });
                } else {
                    // it's menu
                    if (!picker) {
                        var element = menumanager.element,
                            path = element.data('mm-id') + '-',
                            id = randomID(5),
                            base = element.parent('[data-mm-base]').data('mm-base'),
                            col = (element.parent('[data-mm-id]').data('mm-id').match(/\d+$/) || [0])[0],
                            index = indexOf(element.parent().children('[data-mm-id]'), element[0]);

                        while (menumanager.items[path + id]) { id = randomID(5); }

                        menumanager.items[path + id] = response.body.item;
                        if (!menumanager.ordering[base]) menumanager.ordering[base] = [];
                        if (!menumanager.ordering[base][col]) menumanager.ordering[base][col] = [];
                        menumanager.ordering[base][col].splice(index, 1, path + id);
                        element.data('mm-id', path + id);

                        if (response.body.html) {
                            element.html(response.body.html);
                        }

                        menumanager.isNewParticle = false;
                        menumanager.emit('dragEnd', menumanager.map);
                        toastr.success('The Menu Item settings have been applied to the Main Menu. <br />Remember to click the Save button to store them.', 'Settings Applied');
                    } else { // it's field picker
                        var field = $('[name="' + picker.field + '"]'),
                            btnPicker = field.siblings('[data-g-instancepicker]'),
                            label = field.siblings('.g-instancepicker-title');

                        if (field) {
                            field.value(JSON.stringify(response.body.item));
                            $('body').emit('change', { target: field });
                        }
                        if (label) { label.text(response.body.item.title); }

                        if (item.type == 'particle') {
                            btnPicker.text(btnPicker.data('g-instancepicker-alttext'));
                        }
                    }
                }

                modal.close();
                submit.hideIndicator();
            });
        });
    });
};


ready(function() {
    var body = $('body');

    body.delegate('click', '.menu-editor-extras [data-lm-blocktype], .menu-editor-extras [data-mm-module]', function(event, element) {
        var container = element.parent('.menu-editor-extras'),
            elements = container.search('[data-lm-blocktype], [data-mm-module]'),
            selectButton = container.find('[data-mm-select]');

        elements.removeClass('selected');
        element.addClass('selected');

        selectButton.attribute('disabled', null);
    });

    // second step
    body.delegate('click', '.menu-editor-extras [data-mm-select]', function(event, element) {
        event.preventDefault();

        if (element.hasClass('disabled') || element.attribute('disabled')) { return false; }

        var container = element.parent('.menu-editor-extras'),
            selected = container.find('[data-lm-blocktype].selected, [data-mm-module].selected'),
            type = selected.data('mm-type');

        data = { type: type };

        switch (type) {
            case 'particle':
                data['particle'] = selected.data('lm-subtype');
                break;

            case 'widget':
                data['widget'] = selected.data('lm-subtype');
                break;

            case 'module':
                data['particle'] = type;
                data['title'] = selected.find('[data-mm-title]').data('mm-title');
                data['options'] = { particle: { module_id: selected.data('mm-module') } };
                break;
        }

        element.showIndicator();


        var data, instancepicker = element.data('g-instancepicker');

        if (instancepicker && type == 'module') {
            data = JSON.parse(instancepicker);
            var field = $('[name="' + data.field + '"]');
            if (field) {
                field.value(selected.data('mm-module'));
                body.emit('input', { target: field });
            }

            element.hideIndicator();
            modal.close();

            return false;
        } else {
            var ip = instancepicker;
            element.data('g-instancepicker', null);
            StepTwo({
                item: JSON.stringify(data),
                instancepicker: ip ? ip : null
            }, element.parent('.g5-content'), element);
        }
    });
});

module.exports = StepOne;

},{"../ui":49,"../utils/flags-state":63,"../utils/get-ajax-suffix":64,"../utils/get-ajax-url":65,"agent":71,"elements":103,"elements/domready":101,"elements/zen":106,"mout/array/indexOf":144,"mout/lang/deepEquals":169,"mout/string/trim":237}],31:[function(require,module,exports){
"use strict";
var ready         = require('elements/domready'),
    MenuManager   = require('./menumanager'),
    $             = require('elements'),
    zen           = require('elements/zen'),
    modal         = require('../ui').modal,
    toastr        = require('../ui').toastr,
    extraItems    = require('./extra-items'),
    request       = require('agent'),
    trim          = require('mout/string/trim'),
    clamp         = require('mout/math/clamp'),
    contains      = require('mout/array/contains'),
    indexOf       = require('mout/array/indexOf'),
    parseAjaxURI  = require('../utils/get-ajax-url').parse,
    getAjaxSuffix = require('../utils/get-ajax-suffix'),
    validateField = require('../utils/field-validation');

var menumanager;

var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

var FOCUSIN  = isFirefox ? 'focus' : 'focusin',
    FOCUSOUT = isFirefox ? 'blur' : 'focusout';

ready(function() {
    var body = $('body');

    menumanager = new MenuManager('[data-mm-container]', {
        delegate: '.g5-mm-particles-picker ul li, #menu-editor > section ul li, .submenu-column, .submenu-column li[data-mm-id], .column-container .g-block',
        droppables: '#menu-editor [data-mm-id]',
        exclude: '[data-lm-nodrag], .fa-cog, .config-cog',
        resize_handles: '.submenu-column:not(:last-child)',
        catchClick: true
    });


    // Handles Modules / Particles items in the Menu
    menumanager.on('dragEnd', extraItems);

    module.exports.menumanager = menumanager;

    // Menu Manager
    menumanager.setRoot();

    // Refresh ordering/items on menu type change or Menu navigation link
    body.delegate('statechangeAfter', '#main-header [data-g5-ajaxify], select.menu-select-wrap', function(/*event, element*/) {
        menumanager.setRoot();
        menumanager.refresh();

        // refresh MM eraser
        if (menumanager.eraser) {
            menumanager.eraser.element = $('[data-mm-eraseparticle]');
            menumanager.eraser.hide();
        }
    });

    body.delegate(FOCUSIN, '.percentage input', function(event, element) {
        element = $(element);
        element.currentSize = Number(element.value());

        element[0].focus();
        element[0].select();
    }, true);

    body.delegate('keydown', '.percentage input', function(event/*, element*/) {
        if (contains([46, 8, 9, 27, 13, 110, 190], event.keyCode) ||
                // Allow: [Ctrl|Cmd]+A | [Ctrl|Cmd]+R
            (event.keyCode == 65 && (event.ctrlKey === true || event.ctrlKey === true)) ||
            (event.keyCode == 82 && (event.ctrlKey === true || event.metaKey === true)) ||
                // Allow: home, end, left, right, down, up
            (event.keyCode >= 35 && event.keyCode <= 40)) {
            // let it happen, don't do anything
            return;
        }
        // Ensure that it is a number and stop the keypress
        if ((event.shiftKey || (event.keyCode < 48 || event.keyCode > 57)) && (event.keyCode < 96 || event.keyCode > 105)) {
            event.preventDefault();
        }
    });

    body.delegate('keydown', '.percentage input', function(event, element) {
        element = $(element);
        var value  = Number(element.value()),
            min    = Number(element.attribute('min')),
            max    = Number(element.attribute('max')),
            upDown = event.keyCode == 38 || event.keyCode == 40;

        if (upDown) {
            value += event.keyCode == 38 ? +1 : -1;
            value = clamp(value, min, max);
            element.value(value);
            body.emit('keyup', { target: element });
        }
    });

    body.delegate('keyup', '.percentage input', function(event, element) {
        element = $(element);
        var value = Number(element.value()),
            min   = Number(element.attribute('min')),
            max   = Number(element.attribute('max'));

        var resizer = menumanager.resizer,
            parent  = element.parent('[data-mm-id]'),
            sibling = parent.nextSibling('[data-mm-id]') || parent.previousSibling('[data-mm-id]');

        if (!value || value < min || value > max) { return; }

        var sizes = {
            current: Number(element.currentSize),
            sibling: Number(resizer.getSize(sibling))
        };

        element.currentSize = value;

        sizes.total = sizes.current + sizes.sibling;
        sizes.diff = sizes.total - value;

        resizer.setSize(parent, value);
        resizer.setSize(sibling, sizes.diff);

        menumanager.resizer.updateItemSizes(parent.parent('.submenu-selector').search('> [data-mm-id]'));
        menumanager.emit('dragEnd', menumanager.map, 'inputChange');
    });

    body.delegate(FOCUSOUT, '.percentage input', function(event, element) {
        element = $(element);
        var value = Number(element.value());
        if (value < Number(element.attribute('min')) || value > Number(element.attribute('max'))) {
            element.value(element.currentSize);
        }
    }, true);

    // Add new columns
    body.delegate('click', '.add-column', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }
        element = $(element);

        var container = element.parent('[data-g5-menu-columns]').find('.submenu-selector'),
            children  = container.children(),
            last      = container.find('> :last-child'),
            count     = children ? children.length : 0,
            active    = $('.menu-selector .active'),
            path      = active ? active.data('mm-id') : null;

        // do not allow to create a new column if there's already one and it's empty
        if (count == 1 && !children.search('.submenu-items > [data-mm-id]')) { return false; }

        var block = $(last[0].cloneNode(true));
        block.data('mm-id', 'list-' + count);
        block.find('.submenu-items').empty();
        block.find('[data-mm-base-level]').data('mm-base-level', 1);
        block.find('.submenu-level').text('Level 1');
        block.after(last);

        if (!menumanager.ordering[path]) {
            menumanager.ordering[path] = [[]];
        }

        menumanager.ordering[path].push([]);
        menumanager.resizer.evenResize($('.submenu-selector > [data-mm-id]'));
    });

    // Attach events to pseudo (x) for deleting a column
    ['click', 'touchend'].forEach(function(evt) {
        body.delegate(evt, '[data-g5-menu-columns] .submenu-items:empty', function(event, element) {
            var bounding = element[0].getBoundingClientRect(),
                x        = event.pageX || event.changedTouches[0].pageX || 0, y = event.pageY || event.changedTouches[0].pageY || 0,
                siblings = $('.submenu-selector > [data-mm-id]'),
                deleter  = {
                    width: 36,
                    height: 36
                };

            if (siblings.length <= 1) {
                return false;
            }

            if (x >= bounding.left + bounding.width - deleter.width && x <= bounding.left + bounding.width &&
                Math.abs(window.scrollY - y) - bounding.top < deleter.height) {
                var parent    = element.parent('[data-mm-id]'),
                    container = parent.parent('.submenu-selector').children('[data-mm-id]'),
                    index     = indexOf(container, parent),
                    active    = $('.menu-selector .active'),
                    path      = active ? active.data('mm-id') : null;

                parent.remove();
                siblings = $('.submenu-selector > [data-mm-id]');
                menumanager.ordering[path].splice(index, 1);
                menumanager.resizer.evenResize(siblings);
            }
        });
    });

    // Menu Items settings
    body.delegate('click', '#menu-editor .config-cog, #menu-editor .global-menu-settings', function(event, element) {
        event.preventDefault();

        var data = {}, isRoot = element.hasClass('global-menu-settings');

        if (isRoot) {
            data.settings = JSON.stringify(menumanager.settings);
        } else {
            data.item = JSON.stringify(menumanager.items[element.parent('[data-mm-id]').data('mm-id')]);
        }

        modal.open({
            content: 'Loading',
            method: 'post',
            data: data,
            remote: parseAjaxURI($(element).attribute('href') + getAjaxSuffix()),
            remoteLoaded: function(response, content) {
                var form       = content.elements.content.find('form'),
                    fakeDOM    = zen('div').html(response.body.html).find('form'),
                    submit     = content.elements.content.search('input[type="submit"], button[type="submit"], [data-apply-and-save]'),
                    dataString = [], invalid = [],
                    path;

                var search      = content.elements.content.find('.search input'),
                    blocks      = content.elements.content.search('[data-mm-type]'),
                    filters     = content.elements.content.search('[data-mm-filter]'),
                    urlTemplate = content.elements.content.find('.g-urltemplate');

                if (urlTemplate) { body.emit('input', { target: urlTemplate }); }

                var editable = content.elements.content.find('[data-title-editable]');
                if (editable) {
                    editable.on('title-edit-end', function(title, original/*, canceled*/) {
                        title = trim(title);
                        if (!title) {
                            title = trim(original) || 'Title';
                            this.text(title).data('title-editable', title);

                            return true;
                        }
                    });
                }

                if (search && filters && blocks) {
                    search.on('input', function() {
                        if (!this.value()) {
                            blocks.removeClass('hidden');
                            return;
                        }

                        blocks.addClass('hidden');

                        var found = [], value = this.value().toLowerCase(), text;

                        filters.forEach(function(filter) {
                            filter = $(filter);
                            text = trim(filter.data('mm-filter')).toLowerCase();
                            if (text.match(new RegExp("^" + value + '|\\s' + value, 'gi'))) {
                                found.push(filter.matches('[data-mm-type]') ? filter : filter.parent('[data-mm-type]'));
                            }
                        }, this);

                        if (found.length) { $(found).removeClass('hidden'); }
                    });
                }

                if (search) {
                    setTimeout(function() {
                        search[0].focus();
                    }, 5);
                }

                if ((!form && !fakeDOM) || !submit) { return true; }

                // Menuitems Settings apply
                submit.on('click', function(e) {
                    e.preventDefault();

                    var target = $(e.target);

                    dataString = [];
                    invalid = [];

                    target.hideIndicator();
                    target.showIndicator();

                    $(fakeDOM[0].elements).forEach(function(input) {
                        input = $(input);
                        var name = input.attribute('name');
                        if (!name) { return; }

                        input = content.elements.content.find('[name="' + name + '"]');

                        if (!validateField(input)) { invalid.push(input); }
                        dataString.push(name + '=' + encodeURIComponent(input.value()));
                    });

                    var title = content.elements.content.find('[data-title-editable]');
                    if (title) {
                        dataString.push((isRoot ? 'settings[title]' : 'title') + '=' + encodeURIComponent(title.data('title-editable')));
                    }

                    if (invalid.length) {
                        target.hideIndicator();
                        target.showIndicator('fa fa-fw fa-exclamation-triangle');
                        toastr.error('Please review the fields in the modal and ensure you correct any invalid one.', 'Invalid Fields');
                        return;
                    }

                    request(fakeDOM.attribute('method'), parseAjaxURI(fakeDOM.attribute('action') + getAjaxSuffix()), dataString.join('&'), function(error, response) {
                        if (!response.body.success) {
                            modal.open({
                                content: response.body.html || response.body,
                                afterOpen: function(container) {
                                    if (!response.body.html) { container.style({ width: '90%' }); }
                                }
                            });
                        } else {
                            if (response.body.path || (response.body.item && response.body.item.type == 'particle')) {
                                path = response.body.path || element.parent('[data-mm-id]').data('mm-id');
                                menumanager.items[path] = response.body.item;
                            } else if (response.body.item && response.body.item.type == 'particle') {

                            } else {
                                menumanager.settings = response.body.settings;
                            }

                            if (response.body.html) {
                                var parent = element.parent('[data-mm-id]');
                                if (parent) { parent.html(response.body.html); }
                            }

                            menumanager.emit('dragEnd', menumanager.map);

                            // if it's apply and save we also save the panel
                            if (target.data('apply-and-save') !== null) {
                                var save = $('body').find('.button-save');
                                if (save) { body.emit('click', { target: save }); }
                            }

                            modal.close();
                            toastr.success('The Menu Item settings have been applied to the Main Menu. <br />Remember to click the Save button to store them.', 'Settings Applied');
                        }

                        target.hideIndicator();
                    });
                });
            }
        });
    });
});

module.exports = {
    menumanager: menumanager
};

},{"../ui":49,"../utils/field-validation":62,"../utils/get-ajax-suffix":64,"../utils/get-ajax-url":65,"./extra-items":30,"./menumanager":32,"agent":71,"elements":103,"elements/domready":101,"elements/zen":106,"mout/array/contains":135,"mout/array/indexOf":144,"mout/math/clamp":184,"mout/string/trim":237}],32:[function(require,module,exports){
"use strict";
var prime     = require('prime'),
    $         = require('../utils/elements.utils'),
    bind       = require('mout/function/bind'),
    zen       = require('elements/zen'),
    Emitter   = require('prime/emitter'),
    Bound     = require('prime-util/prime/bound'),
    Options   = require('prime-util/prime/options'),
    DragDrop  = require('../ui/drag.drop'),
    Eraser     = require('../ui/eraser'),
    Resizer   = require('./drag.resizer'),
    get       = require('mout/object/get'),

    every     = require('mout/array/every'),
    last      = require('mout/array/last'),
    indexOf   = require('mout/array/indexOf'),
    isArray   = require('mout/lang/isArray'),
    isObject  = require('mout/lang/isObject'),
    deepClone = require('mout/lang/deepClone'),
    equals    = require('mout/object/equals');


var MenuManager = new prime({

    mixin: [Bound, Options],

    inherits: Emitter,

    options: {},

    constructor: function(element, options) {
        this.setOptions(options);
        this.refElement = element;
        this.map = {};

        if (!element || !$(element)) { return; }

        this.init(element);
    },

    init: function() {
        this.setRoot();

        this.dragdrop = new DragDrop(this.refElement, this.options, this);
        this.resizer = new Resizer(this.refElement, this.options, this);
        this.eraser = new Eraser('[data-mm-eraseparticle]', this.options);
        this.dragdrop
            .on('dragdrop:click', this.bound('click'))
            .on('dragdrop:start', this.bound('start'))
            .on('dragdrop:move:once', this.bound('moveOnce'))
            .on('dragdrop:location', this.bound('location'))
            .on('dragdrop:nolocation', this.bound('nolocation'))
            .on('dragdrop:resize', this.bound('resize'))
            .on('dragdrop:stop:erase', this.bound('removeElement'))
            .on('dragdrop:stop', this.bound('stop'))
            .on('dragdrop:stop:animation', this.bound('stopAnimation'));
    },

    refresh: function() {
        if (!this.refElement || !$(this.refElement)) { return; }
        this.init();
    },

    setRoot: function() {
        this.root = $('#menu-editor');

        if (this.root) {
            this.settings = JSON.parse(this.root.data('menu-settings'));
            this.ordering = JSON.parse(this.root.data('menu-ordering'));
            this.items = JSON.parse(this.root.data('menu-items'));

            this.map = {
                settings: deepClone(this.settings),
                ordering: deepClone(this.ordering),
                items: deepClone(this.items)
            };

            var submenus = $('[data-g5-menu-columns] .submenu-selector'), columns;
            if (this.resizer && submenus && (columns = submenus.search('> [data-mm-id]'))) { this.resizer.updateMaxValues(columns); }
        }
    },

    click: function(event, element) {
        var target = $(event.target);
        if (target.matches('.g-menu-addblock') || target.parent('.g-menu-addblock')) {
            return false;
        }

        if (element.hasClass('g-block')) {
            this.stopAnimation();
            return true;
        }

        if (element.find('[data-g5-ajaxify]')) {
            var siblings = element.siblings();
            element.addClass('active');
            if (siblings) { siblings.removeClass('active'); }
        }

        element.emit('click');

        var link = element.find('a');
        if (link) { link[0].click(); }
    },

    resize: function(event, element, siblings, offset) {
        this.resizer.start(event, element, siblings, offset);
    },

    start: function(event, element) {
        var root = element.parent('.menu-selector') || element.parent('.submenu-column') || element.parent('.submenu-selector') || element.parent('.g5-mm-particles-picker'),
            size = $(element).position();

        this.block = null;
        this.targetLevel = undefined;
        this.addNewItem = false;
        this.type =  element.parent('.g-toplevel') || element.matches('.g-toplevel') ? 'main' : (element.matches('.g-block') ? 'column' : 'columns_items');
        this.isParticle = element.matches('[data-mm-blocktype]') || element.matches('[data-mm-original-type]');
        this.wasActive = element.hasClass('active');
        this.isNewParticle = element.parent('.g5-mm-particles-picker');
        this.ParticleIndex = -1;
        this.root = root;

        this.itemID = element.data('mm-id');
        this.itemLevel = element.data('mm-level');
        this.itemFrom = element.parent('[data-mm-id]');
        this.itemTo = null;

        if (this.isParticle && !this.isNewParticle) {
            var children = element.parent().children('[data-mm-id]');
            this.ParticleIndex = indexOf(children, element[0]);
        }

        root.addClass('moving');

        var type = $(element).data('mm-id'),
            clone = element[0].cloneNode(true);

        if (!this.placeholder) { this.placeholder = zen((this.type == 'column' ? 'div' : 'li') + '.block.placeholder[data-mm-placeholder]'); }
        this.placeholder.style({ display: 'none' });
        this.original = $(clone).after(element).style({
            display: 'inline-block',
            opacity: 1
        }).addClass('original-placeholder').data('lm-dropzone', null);
        this.originalType = type;
        this.block = element;

        if (!this.isNewParticle) {
            element.style({
                position: 'absolute',
                zIndex: 1500,
                width: Math.ceil(size.width),
                height: Math.ceil(size.height)
            }).addClass('active');

            this.placeholder.before(element);
        } else {
            var position = element.position(),
                parentOffset = {
                    top: element.parent()[0].scrollTop,
                    left: element.parent()[0].scrollLeft
                };
            this.original.style({
                position: 'absolute',
                opacity: 0.5
            }).style({
                left: element[0].offsetLeft - parentOffset.left,
                top: element[0].offsetTop - parentOffset.top,
                width: position.width,
                height: position.height
            });
            this.element = this.dragdrop.element;
            this.block = this.dragdrop.element;
            this.dragdrop.element = this.original;
        }

        if (this.type == 'column') {
            root.search('.g-block > *').style({ 'pointer-events': 'none' });
        }
    },

    moveOnce: function(element) {
        var type = $(element).data('mm-id');
        if (this.original) { this.original.style({ opacity: 0.5 }); }

        // it's a module or a particle and we allow for them to be deleted
        if (!this.isNewParticle && (type && type.match(/__(module|particle|widget)(-[a-z0-9]{5,})?$/i))) {
            this.eraser.show();
        }
    },

    location: function(event, location, target/*, element*/) {
        target = $(target);
        (!this.isNewParticle ? this.original : this.block).style({transform: 'translate(0, 0)'});
        if (!this.placeholder) { this.placeholder = zen((this.type == 'column' ? 'div' : 'li') + '.block.placeholder[data-mm-placeholder]').style({ display: 'none' }); }

        var targetType = target.parent('.g-toplevel') || target.matches('.g-toplevel') ? 'main' : (target.matches('.g-block') ? 'column' : 'columns_items'),
            dataLevel = target.data('mm-level'),
            originalLevel = this.block.data('mm-level');

        if (this.isParticle && (targetType === 'main' && !dataLevel)) {
            this.dragdrop.matched = false;
            return;
        }

        // Support for nested new particles/modules/widgets
        if (dataLevel === null && this.type === 'columns_items' && this.isParticle && this.isNewParticle) {
            var submenu_items = target.find('.submenu-items');
            if (!submenu_items) {
                this.dragdrop.matched = false;
                return;
            }

            this.placeholder.style({ display: 'block' }).bottom(submenu_items);
            this.addNewItem = submenu_items;
            this.targetLevel = 2;
            this.dragdrop.matched = false;
            return;
        }

        // Workaround for layout and style of columns
        if (dataLevel === null && (this.type === 'columns_items' || this.isParticle)) {
            var submenu_items = target.find('.submenu-items'),
                submenu_items_level = submenu_items.data('mm-base-level');

            // extend drop areas and ensure items cannot be dragged between different levels
            if ((!target.hasClass('g-block') || target.find(this.block)) || (!this.isParticle && originalLevel != submenu_items_level) && (!submenu_items || submenu_items.children() || originalLevel > 2)) {
                this.dragdrop.matched = false;
                return;
            }

            this.placeholder.style({ display: 'block' }).bottom(submenu_items);
            this.addNewItem = submenu_items;
            this.targetLevel = 2;
            this.dragdrop.matched = false;
            return;
        }


        if (!this.isParticle) {

            // We only allow sorting between same level items
            if (this.type !== 'column' && originalLevel !== dataLevel) {
                this.dragdrop.matched = false;
                return;
            }

            // Ensuring columns can only be dragged before/after other columns
            if (this.type == 'column' && dataLevel) {
                this.dragdrop.matched = false;
                return;
            }

            // For levels > 2 we only allow sorting within the same column
            if (dataLevel > 2 && target.parent('ul') != this.block.parent('ul')) {
                this.dragdrop.matched = false;
                return;
            }
        }

        // Check for adjacents and avoid inserting any placeholder since it would be the same position
        var exclude = ':not(.placeholder):not([data-mm-id="' + this.original.data('mm-id') + '"])',
            adjacents = {
                before: this.original.previousSiblings(exclude),
                after: this.original.nextSiblings(exclude)
            };

        if (adjacents.before) { adjacents.before = $(adjacents.before[0]); }
        if (adjacents.after) { adjacents.after = $(adjacents.after[0]); }


        if (targetType === 'main' && ((adjacents.before === target && location.x === 'after') || (adjacents.after === target && location.x === 'before'))) {
            return;
        }
        if (targetType === 'column' && ((adjacents.before === target && location.x === 'after') || (adjacents.after === target && location.x === 'before'))) {
            return;
        }
        if (targetType === 'columns_items' && ((adjacents.before === target && location.y === 'below') || (adjacents.after === target && location.y === 'above'))) {
            return;
        }

        // Handles the types cases and normalizes the locations (x and y)
        switch (targetType) {
            case 'main':
            case 'column':
                this.placeholder[location.x](target);
                break;
            case 'columns_items':
                this.placeholder[location.y === 'above' ? 'before' : 'after'](target);

                break;
        }

        this.targetLevel = dataLevel;

        // If it's not a block we don't want a small version of the placeholder
        this.placeholder.style({ display: 'block' })[targetType !== 'main' ? 'removeClass' : 'addClass']('in-between');

    },

    nolocation: function(event) {
        (!this.isNewParticle ? this.original : this.block).style({transform: 'translate(0, 0)'});
        if (this.placeholder) { this.placeholder.remove(); }
        this.targetLevel = undefined;

        var target = event.type.match(/^touch/i) ? document.elementFromPoint(event.touches.item(0).clientX, event.touches.item(0).clientY) : event.target;

        if (!this.isNewParticle && this.itemID.match(/__(module|particle|widget)(-[a-z0-9]{5})?$/i)) {
            target = $(target);
            if (target.matches(this.eraser.element) || this.eraser.element.find(target)) {
                this.dragdrop.removeElement = true;
                this.eraser.over();
            } else {
                this.dragdrop.removeElement = false;
                this.eraser.out();
            }
        }
    },

    removeElement: function(event, element) {
        this.dragdrop.removeElement = false;

        var transition = {
            opacity: 0
        };

        element.animate(transition, {
            duration: '150ms'
        });

        if (this.type == 'column') {
            this.root.search('.g-block > *').style({ 'pointer-events': 'none' });
        }

        this.eraser.hide();

        this.dragdrop.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
            $('body').off(event, this.dragdrop.bound('move'));
        }, this));

        this.dragdrop.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
            $('body').off(event, this.dragdrop.bound('deferStop'));
        }, this));

        var particle = this.block,
            base = particle.parent('[data-mm-base]').data('mm-base'),
            col = (particle.parent('[data-mm-id]').data('mm-id').match(/\d+$/) || [0])[0],
            index = indexOf(particle.parent().children('[data-mm-id]:not(.original-placeholder)'), particle[0]);

        delete this.items[this.itemID];
        this.ordering[base][col].splice(index, 1);

        this.block.remove();
        this.original.remove();
        this.root.removeClass('moving');

        if (this.root.find('.submenu-items')) {
            if (!this.root.find('.submenu-items').children()) { this.root.find('.submenu-items').text(''); }
        }

        this.emit('dragEnd', this.map, 'reorder');
    },

    stop: function(event, target, element) {
        target = $(target);

        // we are removing the block
        var lastOvered = $(this.dragdrop.lastOvered);
        if (lastOvered && lastOvered.matches(this.eraser.element.find('.trash-zone'))) {
            this.eraser.hide();
            return;
        }

        if (target) { element.removeClass('active'); }
        if (this.type == 'column') {
            this.root.search('.g-block > *').attribute('style', null);
        }

        if (!this.dragdrop.matched && !this.addNewItem) {
            if (this.placeholder) { this.placeholder.remove(); }

            this.type = undefined;
            this.targetLevel = false;
            this.isParticle = undefined;
            this.eraser.hide();
            return;
        }

        var placeholderParent = this.placeholder.parent();
        if (!placeholderParent) {
            this.type = undefined;
            this.targetLevel = false;
            this.isParticle = undefined;
            return;
        }

        if (this.addNewItem) { this.block.attribute('style', null).removeClass('active'); }

        var parent = this.block.parent();
        this.eraser.hide();

        if (this.original) {
            if (!this.isNewParticle) { this.original.remove(); }
            else { this.original.attribute('style', null).removeClass('original-placeholder'); }
        }


        this.block.after(this.placeholder);
        this.placeholder.remove();
        this.itemTo = this.block.parent('[data-mm-id]');
        this.currentLevel = this.itemLevel;
        if (this.wasActive) { element.addClass('active'); }

        if (this.isParticle) {
            var id = last(this.itemID.split('/')),
                targetItem = (target || this.itemTo),
                base = targetItem[target && !target.hasClass('g-block') ? 'parent' : 'find']('[data-mm-base]').data('mm-base');

            this.itemID = base ? base + '/' + id : id;
            this.itemLevel = this.targetLevel;
            this.block.data('mm-id', this.itemID).data('mm-level', this.targetLevel);
        }

        var path = this.itemID.split('/'),
            items, column;

        path.splice(this.itemLevel - 1);
        path = path.join('/');

        // Items reorder for root or sublevels with logic to reorder FROM and TO sublevel column if needed
        if (this.itemFrom || this.itemTo) {
            var sources = this.itemFrom == this.itemTo ? [this.itemFrom] : [this.itemFrom, this.itemTo];
            sources.forEach(function(source) {
                if (!source) { return; }

                items = source.search('[data-mm-id]');
                column = Number(this.block.data('mm-level') > 2 ? 0 : (source.data('mm-id').match(/\d+$/) || [0])[0]);

                if (!items) {
                    this.ordering[path][column] = [];
                    return;
                }

                items = items.map(function(element) {
                    return $(element).data('mm-id');
                });

                if (!this.ordering[path]) { this.ordering[path] = []; }
                this.ordering[path][column] = items;
            }, this);

            // Refresh the origin if it's a particle
            base = this.itemFrom ? (this.itemFrom.attribute('data-mm-base') !== null ? this.itemFrom : this.itemFrom.find('[data-mm-base]')) : null;
            if (this.isParticle && base && this.targetLevel != this.currentLevel) {
                var list = (this.itemFrom.data('mm-id').match(/\d+$/) || [0])[0];
                this.ordering[base.data('mm-base') || ''][list].splice(this.ParticleIndex, 1);
            }
        }

        // Column reordering, we just need to swap the array indexes
        if (!this.itemFrom && !this.itemTo && !this.isParticle) {
            var colsOrder = [],
                active = $('.g-toplevel [data-mm-id].active').data('mm-id');
            items = parent.search('> [data-mm-id]');

            items.forEach(function(element, index) {
                element = $(element);

                var id = element.data('mm-id'),
                    column = Number((id.match(/\d+$/) || [0])[0]);

                element.data('mm-id', id.replace(/\d+$/, index));
                colsOrder.push(this.ordering[active][column]);
            }, this);

            this.ordering[active] = colsOrder;
        }

        if (!parent.children()) { parent.empty(); }

        /*if (console && console.group && console.info && console.table && console.groupEnd) {
         console.group();
         console.info('New Ordering');
         console.table(this.ordering);
         console.groupEnd();
         }*/

        var selector = this.block.parent('.submenu-selector');
        if (selector) { this.resizer.updateItemSizes(selector.search('> [data-mm-id]')); }

        this.emit('dragEnd', this.map, 'reorder');
    },

    stopAnimation: function(/*element*/) {
        var flex = null;
        if (this.type == 'column') { flex = this.resizer.getSize(this.block); }
        if (this.root) { this.root.removeClass('moving'); }
        if (this.block) {
            this.block.attribute('style', null);
            if (flex) { this.block.style('flex', '0 1 ' + flex + ' %'); }
        }

        if (this.original) {
            if (!this.isNewParticle || (!this.dragdrop.matched && !this.targetLevel)) { this.original.remove(); }
            else { this.original.attribute('style', null).removeClass('original-placeholder'); }
        }

        if (!this.wasActive && this.block) { this.block.removeClass('active'); }
    }
});


module.exports = MenuManager;

},{"../ui/drag.drop":46,"../ui/eraser":48,"../utils/elements.utils":60,"./drag.resizer":29,"elements/zen":106,"mout/array/every":138,"mout/array/indexOf":144,"mout/array/last":148,"mout/function/bind":159,"mout/lang/deepClone":168,"mout/lang/isArray":171,"mout/lang/isObject":176,"mout/object/equals":194,"mout/object/get":199,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266}],33:[function(require,module,exports){
'use strict';
var $             = require('elements'),
    ready         = require('elements/domready'),

    zen           = require('elements/zen'),
    modal         = require('../ui').modal,
    toastr        = require('../ui').toastr,
    Eraser        = require('../ui/eraser'),
    request       = require('agent'),
    indexOf       = require('mout/array/indexOf'),
    simpleSort    = require('sortablejs'),

    trim          = require('mout/string/trim'),

    parseAjaxURI  = require('../utils/get-ajax-url').parse,
    getAjaxSuffix = require('../utils/get-ajax-suffix'),
    validateField = require('../utils/field-validation');

var AtomsField   = '[name="page[head][atoms][_json]"]',
    groupOptions = [
        { name: 'atoms', pull: 'clone', put: false },
        { name: 'atoms', pull: true, put: true },
        { name: 'atoms', pull: false, put: false }
    ];

var Atoms = {
    eraser: null,
    lists: {
        picker: null,
        items: null
    },

    serialize: function() {
        var output = [],
            list   = $('.atoms-list'),
            atoms  = list.search('[data-atom-picked]');

        if (!atoms) {
            list.empty();
            return '[]';
        }

        atoms.forEach(function(item) {
            item = $(item);
            output.push(JSON.parse(item.data('atom-picked')));
        });

        return JSON.stringify(output).replace(/\//g, '\\/');
    },

    attachEraser: function() {
        if (Atoms.eraser) {
            Atoms.eraser.element = $('[data-atoms-erase]');
            return;
        }

        Atoms.eraser = new Eraser('[data-atoms-erase]');
    },

    createSortables: function(element) {
        var list, sort;

        Atoms.attachEraser();

        groupOptions.forEach(function(groupOption, i) {
            list = !i ? '.atoms-picker' : (i == 1 ? '.atoms-list' : '#trash');
            list = $(list);
            sort = simpleSort.create(list[0], {
                sort: i == 1,
                filter: '[data-atom-ignore]',
                group: groupOption,
                scroll: false,
                forceFallback: true,
                animation: 100,

                onStart: function(event) {
                    Atoms.attachEraser();

                    var item = $(event.item);
                    item.addClass('atom-dragging');

                    if ($(event.from).hasClass('atoms-list')) {
                        Atoms.eraser.show();
                    }
                },

                onEnd: function(event) {
                    var item = $(event.item);
                    var target = $(this.originalEvent.target);
                    if (target.matches('#trash') || target.parent('#trash')) {
                        item.remove();
                        Atoms.eraser.hide();
                        this.options.onSort();
                        return;
                    }

                    item.removeClass('atom-dragging');

                    if ($(event.from).hasClass('atoms-list')) {
                        Atoms.eraser.hide();
                    }
                },

                onSort: function() {
                    var serial = Atoms.serialize(),
                        field  = $(AtomsField);

                    if (!field) { throw new Error('Field "' + AtomsField + '" not found in the DOM.'); }

                    field.value(serial);
                    $('body').emit('change', { target: field });
                },

                onOver: function(evt) {
                    if (!$(evt.from).matches('.atoms-list')) { return; }

                    var over = $(evt.newIndex);
                    if (over.matches('#trash') || over.parent('#trash')) {
                        Atoms.eraser.over();
                    } else {
                        Atoms.eraser.out();
                    }
                }
            });

            Atoms.lists[!i ? 'picker' : 'items'] = sort;
            if (i == 1) {
                element.SimpleSort = sort;
            }
        });
    }
};

var AttachSettings = function() {
    var body = $('body');

    body.delegate('click', '.atoms-list [data-atom-picked] .config-cog', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }

        var list      = element.parent('ul'),
            dataField = $(AtomsField),
            data      = dataField.value(),
            items     = list.search('> [data-atom-picked]'),
            item      = element.parent('[data-atom-picked]'),
            itemData  = item.data('atom-picked');

        modal.open({
            content: 'Loading',
            method: 'post',
            data: { data: itemData },
            remote: parseAjaxURI(element.attribute('href') + getAjaxSuffix()),
            remoteLoaded: function(response, content) {
                var form       = content.elements.content.find('form'),
                    fakeDOM    = zen('div').html(response.body.html).find('form'),
                    submit     = content.elements.content.search('input[type="submit"], button[type="submit"], [data-apply-and-save]'),
                    dataString = [],
                    invalid    = [],
                    dataValue  = JSON.parse(data);

                if (modal.getAll().length > 1) {
                    var applyAndSave = content.elements.content.search('[data-apply-and-save]');
                    if (applyAndSave) { applyAndSave.remove(); }
                }

                if ((!form && !fakeDOM) || !submit) {
                    return true;
                }

                // Atom Settings apply
                submit.on('click', function(e) {
                    e.preventDefault();

                    var target = $(e.target);

                    dataString = [];
                    invalid = [];

                    target.hideIndicator();
                    target.showIndicator();

                    $(fakeDOM[0].elements).forEach(function(input) {
                        input = $(input);
                        var name = input.attribute('name');
                        if (!name || input.disabled()) { return; }

                        input = content.elements.content.find('[name="' + name + '"]');
                        var value    = input.type() == 'checkbox' ? Number(input.checked()) : input.value(),
                            parent   = input.parent('.settings-param'),
                            override = parent ? parent.find('> input[type="checkbox"]') : null;

                        override = override || $(input.data('override-target'));

                        if (override && !override.checked()) { return; }
                        if (!validateField(input)) { invalid.push(input); }
                        dataString.push(name + '=' + encodeURIComponent(value));
                    });

                    var title = content.elements.content.find('h4 [data-title-editable]');
                    if (title) {
                        dataString.push('title=' + encodeURIComponent(title.data('title-editable')));
                    }

                    if (invalid.length) {
                        target.hideIndicator();
                        target.showIndicator('fa fa-fw fa-exclamation-triangle');
                        toastr.error('Please review the fields in the modal and ensure you correct any invalid one.', 'Invalid Fields');
                        return;
                    }

                    request(fakeDOM.attribute('method'), parseAjaxURI(fakeDOM.attribute('action') + getAjaxSuffix()), dataString.join('&') || {}, function(error, response) {
                        if (!response.body.success) {
                            modal.open({
                                content: response.body.html || response.body,
                                afterOpen: function(container) {
                                    if (!response.body.html) { container.style({ width: '90%' }); }
                                }
                            });
                        } else {
                            var index = indexOf(items, item[0]);
                            dataValue[index] = response.body.item;

                            dataField.value(JSON.stringify(dataValue).replace(/\//g, '\\/'));
                            item.find('.atom-title').text(dataValue[index].title);
                            item.data('atom-picked', JSON.stringify(dataValue[index]).replace(/\//g, '\\/'));

                            // toggle enabled/disabled status as needed
                            var enabled = Number(dataValue[index].attributes.enabled);
                            item[enabled ? 'removeClass' : 'addClass']('atom-disabled');
                            item.attribute('title', enabled ? null : 'This atom has been disabled and it won\'t be rendered on front-end. You can still configure, move and delete.');

                            body.emit('change', { target: dataField });

                            // if it's apply and save we also save the panel
                            if (target.data('apply-and-save') !== null) {
                                var save = $('body').find('.button-save');
                                if (save) { body.emit('click', { target: save }); }
                            }

                            modal.close();
                            toastr.success('Atom Item updated', 'Item Updated');
                        }

                        target.hideIndicator();
                    });
                });
            }
        });
    });
};

ready(function() {
    $('body').delegate('mouseover', '#atoms', function(event, element) {
        if (!element.SimpleSort) { Atoms.createSortables(element); }
    });

    AttachSettings();
});

module.exports = Atoms;
},{"../ui":49,"../ui/eraser":48,"../utils/field-validation":62,"../utils/get-ajax-suffix":64,"../utils/get-ajax-url":65,"agent":71,"elements":103,"elements/domready":101,"elements/zen":106,"mout/array/indexOf":144,"mout/string/trim":237,"sortablejs":273}],34:[function(require,module,exports){
"use strict";

var ready         = require('elements/domready'),
    $             = require('elements'),
    zen           = require('elements/zen'),
    modal         = require('../../ui').modal,
    toastr        = require('../../ui').toastr,
    request       = require('agent'),
    lastItem      = require('mout/array/last'),
    indexOf       = require('mout/array/indexOf'),
    simpleSort    = require('sortablejs'),

    trim          = require('mout/string/trim'),

    parseAjaxURI  = require('../../utils/get-ajax-url').parse,
    getAjaxSuffix = require('../../utils/get-ajax-suffix'),
    validateField = require('../../utils/field-validation');

require('elements/insertion');

ready(function() {
    var body = $('body');

    var addNewByEnter = function(title, key) {
        if (key == 'enter' && this.CollectionNew) {
            this.CollectionNew = false;
            body.emit('click', { target: this.parent('.settings-param').find('[data-collection-addnew]') });
        }

        if (key == 'esc' && this.CollectionNew) {
            this.CollectionNew = false;
            body.emit('click', { target: this.parent('[data-collection-item]').find('[data-collection-remove]') });
        }
    };

    var createSortables = function(list) {
        var lists = list || $('.collection-list ul');
        if (!lists) { return; }
        lists.forEach(function(list) {
            list = $(list);
            list.SimpleSort = simpleSort.create(list[0], {
                handle: '.fa-reorder',
                filter: '[data-collection-nosort]',
                scroll: false,
                animation: 150,
                onStart: function() {
                    $(this.el).addClass('collection-sorting');
                },
                onEnd: function(evt) {
                    var element = $(this.el);
                    element.removeClass('collection-sorting');

                    if (evt.oldIndex === evt.newIndex) { return; }

                    var dataField = element.parent('.settings-param').find('[data-collection-data]'),
                        data = dataField.value();

                    data = JSON.parse(data);

                    data.splice(evt.newIndex, 0, data.splice(evt.oldIndex, 1)[0]);
                    dataField.value(JSON.stringify(data));
                    body.emit('change', { target: dataField });
                }
            });
        });
    };

    createSortables();

    // delegate sortables collections for ajax support
    body.delegate('mouseover', '.collection-list ul', function(event, element) {
        if (!element.SimpleSort) { createSortables(element); }
    });

    // Add new item
    body.delegate('click', '[data-collection-addnew]', function(event, element) {
        var param = element.parent('.settings-param'),
            list = param.find('ul'),
            editall = list.parent().find('[data-collection-editall]'),
            dataField = param.find('[data-collection-data]'),
            tmpl = param.find('[data-collection-template]'),
            items = list.search('> [data-collection-item]') || [],
            last = $(lastItem(items));

        var clone = $(tmpl[0].cloneNode(true)), title, editable;

        if (last) { clone.after(last); }
        else { clone.top(list); }

        if (items.length && editall) { editall.style('display', 'inline-block'); }

        title = clone.find('a');
        editable = title.find('[data-title-editable]');

        var re = new RegExp('%id%', 'g');
        title.href(title.href().replace(re, items.length));

        clone.attribute('style', null).data('collection-item', clone.data('collection-template'));
        clone.attribute('data-collection-template', null);
        clone.attribute('data-collection-nosort', null);
        editable.CollectionNew = true;
        body.emit('click', { target: title.siblings('[data-title-edit]') });

        editable.on('title-edit-exit', addNewByEnter);
        body.emit('change', { target: dataField });
    });

    // Edit Title
    body.delegate('blur', '[data-collection-item] [data-title-editable]', function(event, element) {
        var text = trim(element.text()),
            item = element.parent('[data-collection-item]'),
            key = item.data('collection-item'),
            items = element.parent('ul').search('> [data-collection-item]'),
            dataField = element.parent('.settings-param').find('[data-collection-data]'),
            data = dataField.value(),
            index = indexOf(items, item[0]);

        if (index == -1) { return; }

        data = JSON.parse(data);
        if (!data[index]) { data.splice(index, 0, {}); }
        data[index][key] = text;
        dataField.value(JSON.stringify(data));
        body.emit('change', { target: dataField });
    }, true);

    // Remove item
    body.delegate('click', '[data-collection-remove]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }
        var item = element.parent('[data-collection-item]'),
            list = element.parent('ul'),
            items = list.search('> [data-collection-item]'),
            index = indexOf(items, item[0]),
            dataField = element.parent('.settings-param').find('[data-collection-data]'),
            data = dataField.value();

        data = JSON.parse(data);
        data.splice(index, 1);
        dataField.value(JSON.stringify(data));
        item.remove();
        if (items.length <= 2) { list.parent().find('[data-collection-editall]').style('display', 'none'); }
        body.emit('change', { target: dataField });
    });

    // Preventing click of links when title is being edited
    body.delegate('click', '[data-collection-item] a', function(event, element) {
        if (element.find('[contenteditable]')) {
            event.preventDefault();
            event.stopPropagation();
        }
    });

    // Load item settings
    body.delegate('click', '[data-collection-item] .config-cog, [data-collection-editall]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }

        var editable = element.find('[data-title-editable]');
        if (editable && editable.attribute('contenteditable')) {
            event.stopPropagation();
            return false;
        }

        var isEditAll = element.data('collection-editall') !== null,
            parent = element.parent('.settings-param'),
            dataField = parent.find('[data-collection-data]'),
            data = dataField.value(),
            item = element.parent('[data-collection-item]'),
            items = parent.search('ul > [data-collection-item]');

        var dataPost = { data: isEditAll ? data : JSON.stringify(JSON.parse(data)[indexOf(items, item[0])]) };
        modal.open({
            content: 'Loading',
            method: 'post',
            className: 'g5-dialog-theme-default g5-modal-collection g5-modal-collection-' + (isEditAll ? 'editall' : 'single'),
            data: dataPost,
            remote: parseAjaxURI(element.attribute('href') + getAjaxSuffix()),
            remoteLoaded: function(response, content) {
                var form = content.elements.content.find('form'),
                    fakeDOM = zen('div').html(response.body.html).find('form'),
                    submit = content.elements.content.search('input[type="submit"], button[type="submit"], [data-apply-and-save]'),
                    dataString = [],
                    invalid = [],
                    dataValue = JSON.parse(data);

                if (modal.getAll().length > 1) {
                    var applyAndSave = content.elements.content.search('[data-apply-and-save]');
                    if (applyAndSave) { applyAndSave.remove(); }
                }

                if (dataValue.length == 1) {
                    // TODO: need to determine better how to handle single collections cards
                    //content.elements.content.style({ width: 450 });
                }

                if ((!form && !fakeDOM) || !submit) {
                    return true;
                }

                // Collection Settings apply
                submit.on('click', function(e) {
                    e.preventDefault();

                    var target = $(e.target);

                    dataString = [];
                    invalid = [];

                    target.hideIndicator();
                    target.showIndicator();

                    $(fakeDOM[0].elements).forEach(function(input) {
                        input = $(input);
                        var name = input.attribute('name');
                        if (!name || input.disabled()) { return; }

                        input = content.elements.content.find('[name="' + name + '"]');
                        var value = input.type() == 'checkbox' ? Number(input.checked()) : input.value(),
                            parent = input.parent('.settings-param'),
                            override = parent ? parent.find('> input[type="checkbox"]') : null;

                        override = override || $(input.data('override-target'));

                        if (override && !override.checked()) { return; }
                        if (!validateField(input)) { invalid.push(input); }
                        dataString.push(name + '=' + encodeURIComponent(value));
                    });

                    var titles = content.elements.content.search('[data-title-editable]'), key;
                    if (titles) {
                        titles.forEach(function(title) {
                            title = $(title);
                            key = title.data('collection-key') || 'title';
                            dataString.push(key + '=' + encodeURIComponent(title.data('title-editable')));
                        });
                    }

                    if (invalid.length) {
                        target.hideIndicator();
                        target.showIndicator('fa fa-fw fa-exclamation-triangle');
                        toastr.error('Please review the fields in the modal and ensure you correct any invalid one.', 'Invalid Fields');
                        return;
                    }

                    request(fakeDOM.attribute('method'), parseAjaxURI(fakeDOM.attribute('action') + getAjaxSuffix()), dataString.join('&') || {}, function(error, response) {
                        if (!response.body.success) {
                            modal.open({
                                content: response.body.html || response.body,
                                afterOpen: function(container) {
                                    if (!response.body.html) { container.style({ width: '90%' }); }
                                }
                            });
                        } else {
                            if (item) { // single editing
                                dataValue[indexOf(items, item[0])] = response.body.data;
                            } else { // multi editing
                                dataValue = response.body.data;
                            }

                            dataField.value(JSON.stringify(dataValue));
                            body.emit('change', { target: dataField });

                            element.parent('.settings-param-field').search('ul > [data-collection-item]').forEach(function(item, index) {
                                item = $(item);
                                var label = item.find('[data-title-editable]'),
                                    text = dataValue[index][item.data('collection-item')];

                                label.data('title-editable', text).text(text);
                            });

                            // if it's apply and save we also save the panel
                            if (target.data('apply-and-save') !== null) {
                                var save = $('body').find('.button-save');
                                if (save) { body.emit('click', { target: save }); }
                            }

                            modal.close();
                            toastr.success('Collection Item updated', 'Item Updated');
                        }

                        target.hideIndicator();
                    });
                });
            }
        });
    });
});

module.exports = {};

},{"../../ui":49,"../../utils/field-validation":62,"../../utils/get-ajax-suffix":64,"../../utils/get-ajax-url":65,"agent":71,"elements":103,"elements/domready":101,"elements/insertion":104,"elements/zen":106,"mout/array/indexOf":144,"mout/array/last":148,"mout/string/trim":237,"sortablejs":273}],35:[function(require,module,exports){
"use strict";

var prime      = require('prime'),
    Emitter    = require('prime/emitter'),
    Bound      = require('prime-util/prime/bound'),
    Options    = require('prime-util/prime/options'),
    $          = require('elements'),
    ready      = require('elements/domready'),
    zen        = require('elements/zen'),

    DragEvents = require('../../ui/drag.events'),

    forEach    = require('mout/collection/forEach'),
    bind       = require('mout/function/bind'),
    clamp      = require('mout/math/clamp');

var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

var MOUSEDOWN = DragEvents.EVENTS.START,
    MOUSEMOVE = DragEvents.EVENTS.MOVE,
    MOUSEUP   = DragEvents.EVENTS.STOP,
    FOCUSIN   = isFirefox ? 'focus' : 'focusin';

var ColorPicker = new prime({
    mixin: [Options, Bound],
    inherits: Emitter,
    options: {},
    constructor: function(options) {
        this.setOptions(options);
        this.built = false;
        this.attach();
    },

    attach: function() {
        var body = $('body');

        MOUSEDOWN.forEach(bind(function(mousedown) {
            body.delegate(mousedown, '.g-colorpicker i', this.bound('iconClick'));
        }, this));

        body.delegate(FOCUSIN, '.g-colorpicker input', this.bound('show'), true);


        body.delegate('keydown', '.g-colorpicker input', bind(function(event, element) {
            switch (event.keyCode) {
                case 9: // tab
                    this.hide();
                    break;
                case 13: // enter
                case 27: // esc
                    this.hide();
                    element[0].blur();
                    break;
            }
            return true;
        }, this));

        // Update on keyup
        body.delegate('keyup', '.g-colorpicker input', bind(function(event, element) {
            this.updateFromInput(true, element);
            return true;
        }, this));

        // Update on paste
        body.delegate('paste', '.g-colorpicker input', bind(function(event, element) {
            setTimeout(bind(function() {
                this.updateFromInput(true, element);
            }, this), 1);
        }, this));
    },

    show: function(event, element) {
        var body = $('body');

        if (!this.built) {
            this.build();
        }

        this.element = element;
        this.reposition();
        this.wrapper.addClass('cp-visible');
        this.updateFromInput();

        MOUSEMOVE.forEach(bind(function(mousemove) {
            body.on(mousemove, this.bound('bodyMove'));
        }, this));

        MOUSEDOWN.forEach(bind(function(mousedown) {
            this.wrapper.delegate(mousedown, '.cp-grid, .cp-slider, .cp-opacity-slider', this.bound('bodyDown'));
            body.on(mousedown, this.bound('bodyClick'));
        }, this));

        MOUSEUP.forEach(bind(function(mouseup) {
            body.on(mouseup, this.bound('targetReset'));
        }, this));
    },

    hide: function() {
        var body = $('body');

        if (!this.built) { return; }
        this.wrapper.removeClass('cp-visible');

        MOUSEMOVE.forEach(bind(function(mousemove) {
            body.off(mousemove, this.bound('bodyMove'));
        }, this));

        MOUSEDOWN.forEach(bind(function(mousedown) {
            this.wrapper.undelegate(mousedown, '.cp-grid, .cp-slider, .cp-opacity-slider', this.bound('bodyDown'));
            body.off(mousedown, this.bound('bodyClick'));
        }, this));

        MOUSEUP.forEach(bind(function(mouseup) {
            body.off(mouseup, this.bound('targetReset'));
        }, this));
    },

    iconClick: function(event, element) {
        event.preventDefault();

        var input = $(element).sibling('input');
        input[0].focus();

        this.show(event, input);
    },

    bodyMove: function(event) {
        event.preventDefault();

        if (this.target) { this.move(this.target, event); }
    },

    bodyClick: function(event) {
        var target = $(event.target);
        if (!target.parent('.cp-wrapper') && !target.parent('.g-colorpicker')) {
            this.hide();
        }
    },

    bodyDown: function(event, element) {
        event.preventDefault();

        this.target = element;
        this.move(this.target, event, true);
    },

    targetReset: function(event) {
        event.preventDefault();

        this.target = null;
    },

    move: function(target, event) {
        var input = this.element,
            picker = target.find('.cp-picker'),
            clientRect = target[0].getBoundingClientRect(),
            offsetX = clientRect.left + window.scrollX,
            offsetY = clientRect.top + window.scrollY,
            x = Math.round((event ? event.pageX : 0) - offsetX),
            y = Math.round((event ? event.pageY : 0) - offsetY),
            wx, wy, r, phi;

        // Touch support
        if (event && event.changedTouches) {
            x = (event.changedTouches ? event.changedTouches[0].pageX : 0) - offsetX;
            y = (event.changedTouches ? event.changedTouches[0].pageY : 0) - offsetY;
        }

        if (event && event.manualOpacity) {
            y = clientRect.height;
        }

        // Constrain picker to its container
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > clientRect.width) x = clientRect.width;
        if (y > clientRect.height) y = clientRect.height;

        // Constrain color wheel values to the wheel
        if (target.parent('.cp-mode-wheel') && picker.parent('.cp-grid')) {
            wx = 75 - x;
            wy = 75 - y;
            r = Math.sqrt(wx * wx + wy * wy);
            phi = Math.atan2(wy, wx);

            if (phi < 0) phi += Math.PI * 2;
            if (r > 75) {
                x = 75 - (75 * Math.cos(phi));
                y = 75 - (75 * Math.sin(phi));
            }

            x = Math.round(x);
            y = Math.round(y);
        }

        // Move the picker
        if (target.hasClass('cp-grid')) {
            picker.style({
                top: y,
                left: x
            });

            this.updateFromPicker(input, target);
        } else {
            picker.style({
                top: y
            });
            this.updateFromPicker(input, target);
        }
    },

    build: function() {
        this.wrapper = zen('div.cp-wrapper.cp-with-opacity.cp-mode-hue');
        this.slider = zen('div.cp-slider.cp-sprite').bottom(this.wrapper).appendChild(zen('div.cp-picker'));
        this.opacitySlider = zen('div.cp-opacity-slider.cp-sprite').bottom(this.wrapper).appendChild(zen('div.cp-picker'));
        this.grid = zen('div.cp-grid.cp-sprite').bottom(this.wrapper).appendChild(zen('div.cp-grid-inner')).appendChild(zen('div.cp-picker'));

        zen('div').bottom(this.grid.find('.cp-picker'));

        var tabs = zen('div.cp-tabs').bottom(this.wrapper);

        this.tabs = {
            hue: zen('div.cp-tab-hue.active').text('HUE').bottom(tabs),
            brightness: zen('div.cp-tab-brightness').text('BRI').bottom(tabs),
            saturation: zen('div.cp-tab-saturation').text('SAT').bottom(tabs),
            wheel: zen('div.cp-tab-wheel').text('WHEEL').bottom(tabs),
            transparent: zen('div.cp-tab-transp').text('TRANSPARENT').bottom(tabs)
        };

        MOUSEDOWN.forEach(bind(function(mousedown) {
            tabs.delegate(mousedown, '> div', bind(function(event, element) {
                if (element == this.tabs.transparent) {
                    this.opacity = 0;
                    var sliderHeight = this.opacitySlider.position().height;
                    this.opacitySlider.find('.cp-picker').style({ 'top': clamp(sliderHeight - (sliderHeight * this.opacity), 0, sliderHeight) });
                    this.move(this.opacitySlider, { manualOpacity: true });
                    return;
                }

                var active = tabs.find('.active'),
                    mode = active.attribute('class').replace(/\s|active|cp-tab-/g, ''),
                    newMode = element.attribute('class').replace(/\s|active|cp-tab-/g, '');

                this.wrapper.removeClass('cp-mode-' + mode).addClass('cp-mode-' + newMode);
                active.removeClass('active');
                element.addClass('active');

                this.mode = newMode;
                this.updateFromInput();
            }, this));
        }, this));

        this.wrapper.bottom('#g5-container');

        this.built = true;
        this.mode = 'hue';
    },

    updateFromInput: function(dontFireEvent, element) {
        element = $(element) || this.element;
        var value = element.value(),
            opacity = value.replace(/\s/g, '').match(/^rgba?\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3},(.+)\)/),
            hex, hsb;

        value = rgbstr2hex(value) || value;
        opacity = opacity ? clamp(opacity[1], 0, 1) : 1;

        if (!(hex = parseHex(value))) { hex = '#ffffff'; }
        hsb = hex2hsb(hex);

        if (this.built) {
            // opacity
            this.opacity = opacity;
            var sliderHeight = this.opacitySlider.position().height;
            this.opacitySlider.find('.cp-picker').style({ 'top': clamp(sliderHeight - (sliderHeight * this.opacity), 0, sliderHeight) });

            // bg color
            var gridHeight = this.grid.position().height,
                gridWidth = this.grid.position().width,
                r, phi, x, y;

            sliderHeight = this.slider.position().height;

            switch (this.mode) {
                case 'wheel':
                    // Set grid position
                    r = clamp(Math.ceil(hsb.s * 0.75), 0, gridHeight / 2);
                    phi = hsb.h * Math.PI / 180;
                    x = clamp(75 - Math.cos(phi) * r, 0, gridWidth);
                    y = clamp(75 - Math.sin(phi) * r, 0, gridHeight);
                    this.grid.style({ backgroundColor: 'transparent' }).find('.cp-picker').style({
                        top: y,
                        left: x
                    });

                    // Set slider position
                    y = 150 - (hsb.b / (100 / gridHeight));
                    if (hex === '') y = 0;
                    this.slider.find('.cp-picker').style({ top: y });

                    // Update panel color
                    this.slider.style({
                        backgroundColor: hsb2hex({
                            h: hsb.h,
                            s: hsb.s,
                            b: 100
                        })
                    });
                    break;

                case 'saturation':
                    // Set grid position
                    x = clamp((5 * hsb.h) / 12, 0, 150);
                    y = clamp(gridHeight - Math.ceil(hsb.b / (100 / gridHeight)), 0, gridHeight);
                    this.grid.find('.cp-picker').style({
                        top: y,
                        left: x
                    });

                    // Set slider position
                    y = clamp(sliderHeight - (hsb.s * (sliderHeight / 100)), 0, sliderHeight);
                    this.slider.find('.cp-picker').style({ top: y });

                    // Update UI
                    this.slider.style({
                        backgroundColor: hsb2hex({
                            h: hsb.h,
                            s: 100,
                            b: hsb.b
                        })
                    });
                    this.grid.find('.cp-grid-inner').style({ opacity: hsb.s / 100 });
                    break;

                case 'brightness':
                    // Set grid position
                    x = clamp((5 * hsb.h) / 12, 0, 150);
                    y = clamp(gridHeight - Math.ceil(hsb.s / (100 / gridHeight)), 0, gridHeight);
                    this.grid.find('.cp-picker').style({
                        top: y,
                        left: x
                    });

                    // Set slider position
                    y = clamp(sliderHeight - (hsb.b * (sliderHeight / 100)), 0, sliderHeight);
                    this.slider.find('.cp-picker').style({ top: y });

                    // Update UI
                    this.slider.style({
                        backgroundColor: hsb2hex({
                            h: hsb.h,
                            s: hsb.s,
                            b: 100
                        })
                    });
                    this.grid.find('.cp-grid-inner').style({ opacity: 1 - (hsb.b / 100) });
                    break;
                case 'hue':
                default:
                    // Set grid position
                    x = clamp(Math.ceil(hsb.s / (100 / gridWidth)), 0, gridWidth);
                    y = clamp(gridHeight - Math.ceil(hsb.b / (100 / gridHeight)), 0, gridHeight);
                    this.grid.find('.cp-picker').style({
                        top: y,
                        left: x
                    });

                    // Set slider position
                    y = clamp(sliderHeight - (hsb.h / (360 / sliderHeight)), 0, sliderHeight);
                    this.slider.find('.cp-picker').style({ top: y });

                    // Update panel color
                    this.grid.style({
                        backgroundColor: hsb2hex({
                            h: hsb.h,
                            s: 100,
                            b: 100
                        })
                    });
                    break;
            }
        }

        if (!dontFireEvent) { element.value(this.getValue(hex)); }

        this.emit('change', element, hex, opacity);

    },

    updateFromPicker: function(input, target) {
        var getCoords = function(picker, container) {

            var left, top;
            if (!picker.length || !container) return null;
            left = picker[0].getBoundingClientRect().left;
            top = picker[0].getBoundingClientRect().top;

            return {
                x: left - container[0].getBoundingClientRect().left + (picker[0].offsetWidth / 2),
                y: top - container[0].getBoundingClientRect().top + (picker[0].offsetHeight / 2)
            };

        };

        var hex, hue, saturation, brightness, x, y, r, phi,

            // Panel objects
            grid = this.wrapper.find('.cp-grid'),
            slider = this.wrapper.find('.cp-slider'),
            opacitySlider = this.wrapper.find('.cp-opacity-slider'),

            // Picker objects
            gridPicker = grid.find('.cp-picker'),
            sliderPicker = slider.find('.cp-picker'),
            opacityPicker = opacitySlider.find('.cp-picker'),

            // Picker positions
            gridPos = getCoords(gridPicker, grid),
            sliderPos = getCoords(sliderPicker, slider),
            opacityPos = getCoords(opacityPicker, opacitySlider),

            // Sizes
            gridWidth = grid[0].getBoundingClientRect().width,
            gridHeight = grid[0].getBoundingClientRect().height,
            sliderHeight = slider[0].getBoundingClientRect().height,
            opacitySliderHeight = opacitySlider[0].getBoundingClientRect().height;

        var value = this.element.value();
        value = rgbstr2hex(value) || value;
        if (!(hex = parseHex(value))) { hex = '#ffffff'; }

        // Handle colors
        if (target.hasClass('cp-grid') || target.hasClass('cp-slider')) {

            // Determine HSB values
            switch (this.mode) {
                case 'wheel':
                    // Calculate hue, saturation, and brightness
                    x = (gridWidth / 2) - gridPos.x;
                    y = (gridHeight / 2) - gridPos.y;
                    r = Math.sqrt(x * x + y * y);
                    phi = Math.atan2(y, x);
                    if (phi < 0) phi += Math.PI * 2;
                    if (r > 75) {
                        r = 75;
                        gridPos.x = 69 - (75 * Math.cos(phi));
                        gridPos.y = 69 - (75 * Math.sin(phi));
                    }
                    saturation = clamp(r / 0.75, 0, 100);
                    hue = clamp(phi * 180 / Math.PI, 0, 360);
                    brightness = clamp(100 - Math.floor(sliderPos.y * (100 / sliderHeight)), 0, 100);
                    hex = hsb2hex({
                        h: hue,
                        s: saturation,
                        b: brightness
                    });

                    // Update UI
                    slider.style({
                        backgroundColor: hsb2hex({
                            h: hue,
                            s: saturation,
                            b: 100
                        })
                    });
                    break;

                case 'saturation':
                    // Calculate hue, saturation, and brightness
                    hue = clamp(parseInt(gridPos.x * (360 / gridWidth), 10), 0, 360);
                    saturation = clamp(100 - Math.floor(sliderPos.y * (100 / sliderHeight)), 0, 100);
                    brightness = clamp(100 - Math.floor(gridPos.y * (100 / gridHeight)), 0, 100);
                    hex = hsb2hex({
                        h: hue,
                        s: saturation,
                        b: brightness
                    });

                    // Update UI
                    slider.style({
                        backgroundColor: hsb2hex({
                            h: hue,
                            s: 100,
                            b: brightness
                        })
                    });
                    grid.find('.cp-grid-inner').style({ opacity: saturation / 100 });
                    break;

                case 'brightness':
                    // Calculate hue, saturation, and brightness
                    hue = clamp(parseInt(gridPos.x * (360 / gridWidth), 10), 0, 360);
                    saturation = clamp(100 - Math.floor(gridPos.y * (100 / gridHeight)), 0, 100);
                    brightness = clamp(100 - Math.floor(sliderPos.y * (100 / sliderHeight)), 0, 100);
                    hex = hsb2hex({
                        h: hue,
                        s: saturation,
                        b: brightness
                    });

                    // Update UI
                    slider.style({
                        backgroundColor: hsb2hex({
                            h: hue,
                            s: saturation,
                            b: 100
                        })
                    });
                    grid.find('.cp-grid-inner').style({ opacity: 1 - (brightness / 100) });
                    break;

                default:
                    // Calculate hue, saturation, and brightness
                    hue = clamp(360 - parseInt(sliderPos.y * (360 / sliderHeight), 10), 0, 360);
                    saturation = clamp(Math.floor(gridPos.x * (100 / gridWidth)), 0, 100);
                    brightness = clamp(100 - Math.floor(gridPos.y * (100 / gridHeight)), 0, 100);
                    hex = hsb2hex({
                        h: hue,
                        s: saturation,
                        b: brightness
                    });

                    // Update UI
                    grid.style({
                        backgroundColor: hsb2hex({
                            h: hue,
                            s: 100,
                            b: 100
                        })
                    });
                    break;

            }
        }

        // Handle opacity
        if (target.hasClass('cp-opacity-slider')) {
            this.opacity = parseFloat(1 - (opacityPos.y / opacitySliderHeight)).toFixed(2);
        }

        // Adjust case
        input.value(this.getValue(hex));

        // Handle change event
        this.emit('change', this.element, hex, this.opacity);

    },

    reposition: function() {
        var offset = this.element[0].getBoundingClientRect(),
            ct = $('#g5-container')[0].getBoundingClientRect();
        this.wrapper.style({
            top: offset.top + offset.height - ct.top,
            left: offset.left - ct.left
        });
    },

    getValue: function(hex) {
        if (this.opacity == 1) { return hex; }
        var rgb = hex2rgb(hex);
        return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + this.opacity + ')';
    }
});

// Parses a string and returns a valid hex string when possible
var parseHex = function(string) {
    string = string.replace(/[^A-F0-9]/ig, '');
    if (string.length !== 3 && string.length !== 6) return '';
    if (string.length === 3) {
        string = string[0] + string[0] + string[1] + string[1] + string[2] + string[2];
    }

    return '#' + string.toLowerCase();
};

// Converts an HSB object to an RGB object
var hsb2rgb = function(hsb) {
    var rgb = {};
    var h = Math.round(hsb.h);
    var s = Math.round(hsb.s * 255 / 100);
    var v = Math.round(hsb.b * 255 / 100);
    if (s === 0) {
        rgb.r = rgb.g = rgb.b = v;
    } else {
        var t1 = v;
        var t2 = (255 - s) * v / 255;
        var t3 = (t1 - t2) * (h % 60) / 60;
        if (h === 360) h = 0;
        if (h < 60) {
            rgb.r = t1;
            rgb.b = t2;
            rgb.g = t2 + t3;
        }
        else if (h < 120) {
            rgb.g = t1;
            rgb.b = t2;
            rgb.r = t1 - t3;
        }
        else if (h < 180) {
            rgb.g = t1;
            rgb.r = t2;
            rgb.b = t2 + t3;
        }
        else if (h < 240) {
            rgb.b = t1;
            rgb.r = t2;
            rgb.g = t1 - t3;
        }
        else if (h < 300) {
            rgb.b = t1;
            rgb.g = t2;
            rgb.r = t2 + t3;
        }
        else if (h < 360) {
            rgb.r = t1;
            rgb.g = t2;
            rgb.b = t1 - t3;
        }
        else {
            rgb.r = 0;
            rgb.g = 0;
            rgb.b = 0;
        }
    }
    return {
        r: Math.round(rgb.r),
        g: Math.round(rgb.g),
        b: Math.round(rgb.b)
    };
};

// Converts an RGB object to a hex string
var rgb2hex = function(rgb) {
    var hex = [
        rgb.r.toString(16),
        rgb.g.toString(16),
        rgb.b.toString(16)
    ];

    forEach(hex, function(val, nr) {
        if (val.length === 1) hex[nr] = '0' + val;
    });

    return '#' + hex.join('');
};

var rgbstr2hex = function(rgb) {
    rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
    return (rgb && rgb.length === 4) ? "#" +
    ("0" + parseInt(rgb[1], 10).toString(16)).slice(-2) +
    ("0" + parseInt(rgb[2], 10).toString(16)).slice(-2) +
    ("0" + parseInt(rgb[3], 10).toString(16)).slice(-2) : '';
};

// Converts an HSB object to a hex string
var hsb2hex = function(hsb) {
    return rgb2hex(hsb2rgb(hsb));
};

// Converts a hex string to an HSB object
var hex2hsb = function(hex) {
    var hsb = rgb2hsb(hex2rgb(hex));
    if (hsb.s === 0) hsb.h = 360;
    return hsb;
};

// Converts an RGB object to an HSB object
var rgb2hsb = function(rgb) {
    var hsb = {
        h: 0,
        s: 0,
        b: 0
    };
    var min = Math.min(rgb.r, rgb.g, rgb.b);
    var max = Math.max(rgb.r, rgb.g, rgb.b);
    var delta = max - min;
    hsb.b = max;
    hsb.s = max !== 0 ? 255 * delta / max : 0;
    if (hsb.s !== 0) {
        if (rgb.r === max) {
            hsb.h = (rgb.g - rgb.b) / delta;
        } else if (rgb.g === max) {
            hsb.h = 2 + (rgb.b - rgb.r) / delta;
        } else {
            hsb.h = 4 + (rgb.r - rgb.g) / delta;
        }
    } else {
        hsb.h = -1;
    }
    hsb.h *= 60;
    if (hsb.h < 0) {
        hsb.h += 360;
    }
    hsb.s *= 100 / 255;
    hsb.b *= 100 / 255;
    return hsb;
};

// Converts a hex string to an RGB object
var hex2rgb = function(hex) {
    hex = parseInt(((hex.indexOf('#') > -1) ? hex.substring(1) : hex), 16);
    return {
        /* jshint ignore:start */
        r: hex >> 16,
        g: (hex & 0x00FF00) >> 8,
        b: (hex & 0x0000FF)
        /* jshint ignore:end */
    };
};


ready(function() {
    var x = new ColorPicker(), body = $('body');
    x.on('change', function(element, hex, opacity) {
        clearTimeout(this.timer);
        var rgb = hex2rgb(hex),
            yiq = (((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000) >= 128 ? 'dark' : 'light',
            check = yiq == 'dark' || (!opacity || opacity < 0.35);

        if (opacity < 1) {
            var str = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + opacity + ')';
            element.style({ backgroundColor: str });
        } else {
            element.style({ backgroundColor: hex });
        }

        element.parent('.g-colorpicker')[!check ? 'addClass' : 'removeClass']('light-text');

        this.timer = setTimeout(function() {
            element.emit('input');
            body.emit('input', { target: element });
        }, 150);

    });
});

module.exports = ColorPicker;

},{"../../ui/drag.events":47,"elements":103,"elements/domready":101,"elements/zen":106,"mout/collection/forEach":156,"mout/function/bind":159,"mout/math/clamp":184,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266}],36:[function(require,module,exports){
"use strict";

var $             = require('../../utils/elements.utils'),
    prime         = require('prime'),
    request       = require('agent'),
    zen           = require('elements/zen'),
    domready      = require('elements/domready'),
    bind          = require('mout/function/bind'),
    rtrim         = require('mout/string/rtrim'),
    deepClone     = require('mout/lang/deepClone'),
    deepFillIn    = require('mout/object/deepFillIn'),
    modal         = require('../../ui').modal,
    getAjaxSuffix = require('../../utils/get-ajax-suffix'),
    parseAjaxURI  = require('../../utils/get-ajax-url').parse,
    getAjaxURL    = require('../../utils/get-ajax-url').global,
    dropzone      = require('dropzone');

var FilePicker = new prime({
    constructor: function(element) {
        var data = element.data('g5-filepicker'), value;
        this.data = data ? JSON.parse(data) : false;

        if (this.data && !this.data.value) {
            this.data.value = $(this.data.field).value();
        }

        this.colors = {
            error: '#D84747',
            success: '#9ADF87',
            small: '#aaaaaa',
            gradient: ['#9e38eb', '#4e68fc']
        };

        //console.log(this.data);
    },

    open: function() {
        if (this.data) {
            this.data.value = $(this.data.field).value();
        }

        modal.open({
            method: 'post',
            data: this.data,
            content: 'Loading',
            className: 'g5-dialog-theme-default g5-modal-filepicker',
            remote: parseAjaxURI(getAjaxURL('filepicker') + getAjaxSuffix()),
            remoteLoaded: bind(this.loaded, this),
            afterClose: bind(function() {
                if (this.dropzone) { this.dropzone.destroy(); }
            }, this)
        });
    },

    getPath: function() {
        var actives = this.content.search('.g-folders .active'), active, path;
        if (!actives) { return null; }

        active = $(actives[actives.length - 1]);
        path = JSON.parse(active.data('folder')).pathname;
        return path.replace(/\/$/, '') + '/';
    },

    getPreviewTemplate: function() {
        var li    = zen('li[data-file]'),
            del   = zen('span.g-file-delete[data-g-file-delete][data-dz-remove]').html('<i class="fa fa-fw fa-trash-o"></i>').bottom(li),
            thumb = zen('div.g-thumb[data-dz-thumbnail]').bottom(li),
            name  = zen('span.g-file-name[data-dz-name]').bottom(li),
            size  = zen('span.g-file-size[data-dz-size]').bottom(li),
            mtime = zen('span.g-file-mtime[data-dz-mtime]').bottom(li);

        zen('span.g-file-progress[data-file-uploadprogress]').html('<span class="g-file-progress-text"></span>').bottom(li);
        zen('div').bottom(thumb);

        li.bottom('body');
        var html = li[0].outerHTML;
        li.remove();

        return html;
    },

    loaded: function(response, modalInstance) {
        var content   = modalInstance.elements.content,
            bookmarks = content.search('.g-bookmark'),
            files     = content.find('.g-files'),
            fieldData = deepClone(this.data),
            colors    = this.colors,
            self      = this;

        this.content = content;

        if (files) {
            this.dropzone = new dropzone('body', {
                previewTemplate: this.getPreviewTemplate(),
                previewsContainer: files.find('ul:not(.g-list-labels)')[0],
                thumbnailWidth: 100,
                thumbnailHeight: 100,
                clickable: '[data-upload]',
                acceptedFiles: this.acceptedFiles(this.data.filter) || '',
                accept: bind(function(file, done) {
                    if (!this.data.filter) { done(); }
                    else {
                        if (file.name.match(this.data.filter)) { done(); }
                        else { done('<code>' + file.name + '</code> does not match the filter: <br />  <code>' + this.data.filter + '</code>'); }
                    }
                }, this),
                url: bind(function(file) {
                    return parseAjaxURI(getAjaxURL('filepicker/upload/' + window.btoa(this.getPath() + file[0].name)) + getAjaxSuffix());
                }, this)
            });

            // dropzone events
            this.dropzone.on('thumbnail', function(file, dataUrl) {
                var ext = file.name.split('.');
                ext = (!ext.length || ext.length == 1) ? '-' : ext.reverse()[0];
                $(file.previewElement).addClass('g-image g-image-' + ext.toLowerCase()).find('[data-dz-thumbnail] > div').attribute('style', 'background-image: url(' + encodeURI(dataUrl) + ');');
            });

            this.dropzone.on('addedfile', function(file) {
                var element      = $(file.previewElement),
                    uploader     = element.find('[data-file-uploadprogress]'),
                    isList       = files.hasClass('g-filemode-list'),
                    progressConf = {
                        value: 0,
                        animation: false,
                        insertLocation: 'bottom'
                    };

                var ext = file.name.split('.');
                ext = (!ext.length || ext.length == 1) ? '-' : ext.reverse()[0];

                if (!file.type.match(/image.*/)) {
                    element.find('.g-thumb').text(ext);
                } else {
                    element.find('.g-thumb').addClass('g-image g-image-' + ext.toLowerCase());
                }

                progressConf = deepFillIn((isList ? {
                    size: 20,
                    thickness: 10,
                    fill: {
                        color: colors.small,
                        gradient: false
                    }
                } : {
                    size: 50,
                    thickness: 'auto',
                    fill: {
                        gradient: colors.gradient,
                        color: false
                    }
                }), progressConf);

                element.addClass('g-file-uploading');
                uploader.progresser(progressConf);
                uploader.attribute('title', 'processing...').find('.g-file-progress-text').html('&bull;&bull;&bull;').attribute('title', 'processing...');

            }).on('processing', function(file) {

                var element = $(file.previewElement).find('[data-file-uploadprogress]');
                element.find('.g-file-progress-text').text('0%').attribute('title', '0%');

            }).on('sending', function(file, xhr, formData) {

                var element = $(file.previewElement).find('[data-file-uploadprogress]');
                element.attribute('title', '0%').find('.g-file-progress-text').text('0%').attribute('title', '0%');

            }).on('uploadprogress', function(file, progress, bytesSent) {

                var element = $(file.previewElement).find('[data-file-uploadprogress]');
                element.progresser({ value: progress / 100 });
                element.attribute('title', Math.round(progress) + '%').find('.g-file-progress-text').text(Math.round(progress) + '%').attribute('title', Math.round(progress) + '%');

            }).on('complete', function(file) {
                self.refreshFiles(content);
            }).on('error', function(file, error) {
                var element  = $(file.previewElement),
                    uploader = element.find('[data-file-uploadprogress]'),
                    text     = element.find('.g-file-progress-text'),
                    isList   = files.hasClass('g-filemode-list');

                element.addClass('g-file-error');

                uploader.title('Error').progresser({
                    fill: {
                        color: colors.error,
                        gradient: false
                    },
                    value: 1,
                    thickness: isList ? 10 : 25
                });

                text.title('Error').html('<i class="fa fa-exclamation"></i>').parent('[data-file-uploadprogress]').popover({
                    content: error.html ? error.html : (error.error && error.error.message ? error.error.message : error),
                    placement: 'auto',
                    trigger: 'mouse',
                    style: 'filepicker, above-modal',
                    width: 'auto',
                    targetEvents: false
                });

            }).on('success', function(file, response, xhr) {
                var element  = $(file.previewElement),
                    uploader = element.find('[data-file-uploadprogress]'),
                    mtime    = element.find('.g-file-mtime'),
                    text     = element.find('.g-file-progress-text'),
                    thumb    = element.find('.g-thumb'),
                    isList   = files.hasClass('g-filemode-list');

                uploader.progresser({
                    fill: {
                        color: colors.success,
                        gradient: false
                    },
                    value: 1,
                    thickness: isList ? 10 : 25
                });

                text.html('<i class="fa fa-check"></i>');

                setTimeout(bind(function() {
                    uploader.animate({ opacity: 0 }, { duration: 500 });
                    thumb.animate({ opacity: 1 }, {
                        duration: 500,
                        callback: function() {
                            element.data('file', JSON.stringify(response.finfo)).data('file-url', response.url).removeClass('g-file-uploading');
                            element.dropzone = file;
                            uploader.remove();
                            mtime.text('just now');
                        }
                    });
                }, this), 500);
            });
        }

        // g5 events
        content.delegate('click', '.g-bookmark-title', function(e, element) {
            if (event && event.preventDefault) { event.preventDefault(); }
            var sibling = element.nextSibling('.g-folders'),
                parent  = element.parent('.g-bookmark');

            if (!sibling) { return; }
            sibling.slideToggle(function() {
                parent.toggleClass('collapsed', sibling.gSlideCollapsed);
            });
        });

        content.delegate('click', '[data-folder]', bind(function(event, element) {
            if (event && event.preventDefault) { event.preventDefault(); }
            var data     = JSON.parse(element.data('folder')),
                selected = $('[data-file].selected');

            fieldData.root = data.pathname;
            fieldData.value = selected ? selected.data('file-url') : false;
            fieldData.subfolder = true;

            element.showIndicator('fa fa-li fa-fw fa-spin-fast fa-spinner');
            request(parseAjaxURI(getAjaxURL('filepicker') + getAjaxSuffix()), fieldData).send(bind(function(error, response) {
                element.hideIndicator();
                this.addActiveState(element);

                if (!response.body.success) {
                    modal.open({
                        content: response.body.html || response.body,
                        afterOpen: function(container) {
                            if (!response.body.html) { container.style({ width: '90%' }); }
                        }
                    });
                } else {
                    var dummy, next;
                    if (response.body.subfolder) {
                        dummy = zen('div').html(response.body.subfolder);
                        next = element.nextSibling();

                        if (next && !next.attribute('data-folder')) { next.remove(); }
                        dummy.children().after(element);
                    }

                    if (response.body.files) {
                        files.empty();
                        dummy = zen('div').html(response.body.files);
                        dummy.children().bottom(files).style({ opacity: 0 }).animate({ opacity: 1 }, { duration: '250ms' });
                    } else {
                        files.find('> ul:not(.g-list-labels)').empty();
                    }

                    this.dropzone.previewsContainer = files.find('ul:not(.g-list-labels)')[0];
                }
            }, this));
        }, this));

        content.delegate('click', '[data-g-file-preview]', bind(function(event, element) {
            event.preventDefault();
            event.stopPropagation();
            var parent    = element.parent('[data-file]'),
                data      = JSON.parse(parent.data('file'));

            if (data.isImage) {
                var thumb = parent.find('.g-thumb > div');
                modal.open({
                    className: 'g5-dialog-theme-default g5-modal-filepreview center',
                    content: '<img src="' + thumb[0].style.backgroundImage.slice(4, -1).replace(/"/g, '') + '" />'
                });
            }
        }, this));

        content.delegate('click', '[data-g-file-delete]', bind(function(event, element) {
            event.preventDefault();
            var parent    = element.parent('[data-file]'),
                data      = JSON.parse(parent.data('file')),
                deleteURI = parseAjaxURI(getAjaxURL('filepicker/' + window.btoa(data.pathname)) + getAjaxSuffix());

            if (!data.isInCustom) { return false; }

            request('delete', deleteURI, function(error, response) {
                if (!response.body.success) {
                    modal.open({
                        content: response.body.html || response.body,
                        afterOpen: function(container) {
                            if (!response.body.html) { container.style({ width: '90%' }); }
                        }
                    });
                } else {
                    parent.addClass('g-file-deleted');
                    setTimeout(function() {
                        parent.remove();

                        self.refreshFiles(content);
                    }, 210);
                }
            });
        }, this));

        content.delegate('click', '[data-file]', bind(function(event, element) {
            if (event && event.preventDefault) { event.preventDefault(); }
            var target = $(event.target),
                remove = target.data('g-file-delete') !== null || target.parent('[data-g-file-delete]'),
                preview = target.data('g-file-preview') !== null || target.parent('[data-g-file-preview]');

            if (element.hasClass('g-file-error') || element.hasClass('g-file-uploading') || remove || preview) { return; }
            var data = JSON.parse(element.data('file'));

            files.search('[data-file]').removeClass('selected');
            element.addClass('selected');
        }, this));

        content.delegate('click', '[data-select]', bind(function(event, element) {
            if (event && event.preventDefault) { event.preventDefault(); }
            var selected = files.find('[data-file].selected'),
                value    = selected ? selected.data('file-url') : '';

            $(this.data.field).value(value);
            modal.close();
        }, this));

        content.delegate('click', '[data-files-mode]', bind(function(event, element) {
            if (event && event.preventDefault) { event.preventDefault(); }
            if (element.hasClass('active')) { return; }

            var modes = $('[data-files-mode]');
            modes.removeClass('active');
            element.addClass('active');

            files.animate({ opacity: 0 }, {
                duration: 200,
                callback: function() {
                    var mode           = element.data('files-mode'),
                        uploadProgress = files.search('[data-file-uploadprogress]'),
                        progressConf   = (mode == 'list') ? {
                            size: 20,
                            thickness: 10,
                            fill: {
                                color: colors.small,
                                gradient: false
                            }
                        } : {
                            size: 50,
                            thickness: 'auto',
                            fill: {
                                gradient: colors.gradient,
                                color: false
                            }
                        };


                    files.attribute('class', 'g-files g-block g-filemode-' + mode);
                    if (uploadProgress) {
                        uploadProgress.forEach(function(element) {
                            element = $(element);
                            var config = deepClone(progressConf);

                            if (element.parent('.g-file-error')) {
                                config.fill = { color: colors.error };
                                config.value = 1;
                                config.thickness = mode == 'list' ? 10 : 25;
                            }

                            element.progresser(config);
                        });
                    }
                    files.animate({ opacity: 1 }, { duration: 200 });
                }
            });

        }, this));
    },

    addActiveState: function(element) {
        var opened = this.content.search('[data-folder].active, .g-folders > .active'), parent = element.parent();
        if (opened) { opened.removeClass('active'); }

        element.addClass('active');

        while (parent.tag() == 'ul' && !parent.hasClass('g-folders')) {
            parent.previousSibling().addClass('active');
            parent = parent.parent();
        }
    },

    acceptedFiles: function(filter) {
        var attr = '';
        switch (filter) {
            case '.(jpe?g|gif|png|svg)$':
                attr = '.jpg,.jpeg,.gif,.png,.svg';
                break;
            case '.(mp4|webm|ogv|mov)$':
                attr = '.mp4,.webm,.ogv,.mov';
                break;
        }

        return attr;
    },

    refreshFiles: function(content) {
        var active = $('[data-folder].active'),
            folder = active[active.length - 1];
        if (folder) {
            content.emit('click', { target: $(folder) });
        }
    }
});

domready(function() {
    var body = $('body');
    body.delegate('click', '[data-g5-filepicker]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }
        element = $(element);
        if (!element.GantryFilePicker) {
            element.GantryFilePicker = new FilePicker(element);
        }

        element.GantryFilePicker.open();
    });
});


module.exports = FilePicker;

},{"../../ui":49,"../../utils/elements.utils":60,"../../utils/get-ajax-suffix":64,"../../utils/get-ajax-url":65,"agent":71,"dropzone":97,"elements/domready":101,"elements/zen":106,"mout/function/bind":159,"mout/lang/deepClone":168,"mout/object/deepFillIn":192,"mout/string/rtrim":235,"prime":267}],37:[function(require,module,exports){
"use strict";
// fonts list: https://www.googleapis.com/webfonts/v1/webfonts?key=AIzaSyB2yJM8DBwt66u2MVRgb6M4t9CqkW7_IRY
var prime         = require('prime'),
    $             = require('../../utils/elements.utils'),
    zen           = require('elements/zen'),
    storage       = require('prime/map')(),
    Emitter       = require('prime/emitter'),
    Bound         = require('prime-util/prime/bound'),
    Options       = require('prime-util/prime/options'),
    domready      = require('elements/domready'),

    decouple      = require('../../utils/decouple'),

    bind          = require('mout/function/bind'),
    map           = require('mout/array/map'),
    forEach       = require('mout/array/forEach'),
    contains      = require('mout/array/contains'),
    last          = require('mout/array/last'),
    split         = require('mout/array/split'),
    removeAll     = require('mout/array/removeAll'),
    insert        = require('mout/array/insert'),
    append        = require('mout/array/append'),
    find          = require('mout/array/find'),
    combine       = require('mout/array/combine'),
    intersection  = require('mout/array/intersection'),
    merge         = require('mout/object/merge'),

    unhyphenate   = require('mout/string/unhyphenate'),
    properCase    = require('mout/string/properCase'),
    trim          = require('mout/string/trim'),
    getAjaxSuffix = require('../../utils/get-ajax-suffix'),
    parseAjaxURI  = require('../../utils/get-ajax-url').parse,
    getAjaxURL    = require('../../utils/get-ajax-url').global,

    modal         = require('../../ui').modal,
    asyncForEach  = require('../../utils/async-foreach'),

    request       = require('agent'),

    wf            = require('webfontloader');

require('../../utils/elements.viewport');

var isIE = function() {
    var ua = window.navigator.userAgent;
    return ua.indexOf('MSIE ') > 0 || ua.indexOf('Trident/') > 0 || ua.indexOf('Edge/') > 0 || false;
};

var Fonts = new prime({

    mixin: Bound,

    inherits: Emitter,

    previewSentence: {
        'latin': 'Wizard boy Jack loves the grumpy Queen\'s fox.',
        'latin-ext': 'Wizard boy Jack loves the grumpy Queen\'s fox.',
        'arabic': 'نص حكيم له سر قاطع وذو شأن عظيم مكتوب على ثوب أخضر ومغلف بجلد أزرق',
        'cyrillic': 'В чащах юга жил бы цитрус? Да, но фальшивый экземпляр!',
        'cyrillic-ext': 'В чащах юга жил бы цитрус? Да, но фальшивый экземпляр!',
        'devanagari': 'एक पल का क्रोध आपका भविष्य बिगाड सकता है',
        'greek': 'Τάχιστη αλώπηξ βαφής ψημένη γη, δρασκελίζει υπέρ νωθρού κυνός',
        'greek-ext': 'Τάχιστη αλώπηξ βαφής ψημένη γη, δρασκελίζει υπέρ νωθρού κυνός',
        'hebrew': 'דג סקרן שט בים מאוכזב ולפתע מצא חברה',
        'khmer': 'ខ្ញុំអាចញ៉ាំកញ្ចក់បាន ដោយគ្មានបញ្ហា',
        'telugu': 'దేశ భాషలందు తెలుగు లెస్స',
        'vietnamese': 'Tôi có thể ăn thủy tinh mà không hại gì.'
    },

    constructor: function() {
        this.wf = wf;
        this.field = null;
        this.element = null;
        this.throttle = false;
        this.selected = null;
        this.loadedFonts = [];
        this.filters = {
            search: '',
            script: 'latin',
            categories: []
        };
    },

    open: function(event, element) {
        var data = element.data('g5-fontpicker');
        if (!data) {
            throw new Error('No fontpicker data found');
        }

        data = JSON.parse(data);
        this.field = $(data.field);

        modal.open({
            content: 'Loading...',
            className: 'g5-dialog-theme-default g5-modal-fonts',
            remote: parseAjaxURI(getAjaxURL('fontpicker') + getAjaxSuffix()),
            remoteLoaded: bind(function(response, content) {
                var container = content.elements.content;

                this.attachEvents(container);
                this.updateCategories(container);

                this.search();

                this.scroll(container.find('ul.g-fonts-list'));
                this.updateTotal();
                this.selectFromValue();

                setTimeout(function() {
                    container.find('.particle-search-wrapper input')[0].focus();
                }, 5);
            }, this)
        });
    },

    scroll: function(container) {
        clearTimeout(this.throttle);
        this.throttle = setTimeout(bind(function() {
            if (!container) {
                clearTimeout(this.throttle);
                return;
            }

            // 550 = container height, 5 = pages
            var elements = (container.find('ul.g-fonts-list') || container).inviewport(' > li:not(.g-font-hide)', (550 * (isIE() ? 2 : 7))),
                list     = [];

            if (!elements) { return; }

            $(elements).forEach(function(element) {
                element = $(element);
                var dataFont = element.data('font'),
                    variant  = element.data('variant');

                if (!contains(this.loadedFonts, dataFont) && variant) {
                    list.push(dataFont + (variant != 'regular' ? ':' + variant : ''));
                }
                else {
                    if (variant) {
                        element.find('[data-variant="' + variant + '"] .preview').style({
                            fontFamily: dataFont,
                            fontWeight: variant == 'regular' ? 'normal' : variant
                        });
                    }
                }
            }, this);

            if (!list || !list.length) { return; }

            this.wf.load({
                classes: false,
                google: {
                    families: list
                },
                fontactive: bind(function(family, fvd) {
                    container.find('li[data-font="' + family + '"]:not(.g-variant-hide) > .preview').style({
                        fontFamily: family,
                        fontWeight: fvd
                    });
                    this.loadedFonts.push(family);
                }, this)
            });
        }, this), 100);
    },

    unselect: function(selected) {
        selected = selected || this.selected;
        if (!selected) { return false; }

        var baseVariant = selected.element.data('variant');
        selected.element.removeClass('selected');
        selected.element.search('input[type=checkbox]').checked(false);
        selected.element.search('[data-font]').addClass('g-variant-hide');
        selected.element.find('[data-variant="' + baseVariant + '"]').removeClass('g-variant-hide');
        selected.variants = [selected.baseVariant];
        selected.selected = [];
    },

    selectFromValue: function() {
        var value = this.field.value(), name, variants, subset, isLocal = false;

        if (!value.match('family=')) {
            var locals = $('[data-category="local-fonts"][data-font]') || [], intersect;
            locals = locals.map(function(l) { return $(l).data('font'); });
            value = value.replace(/(\s{1,})?,(\s{1,})?/gi, ',').split(',');
            intersect = intersection(locals, value);
            if (!intersect.length) { return false; }

            isLocal = true;
            name = intersect.shift();
        } else {
            var split  = value.split('&'),
                family = split[0],
                split2 = family.split(':');

            name = split2[0].replace('family=', '').replace(/\+/g, ' ');
            variants = split2[1] ? split2[1].split(',') : ['regular'];
            subset = split[1] ? split[1].replace('subset=', '').split(',') : ['latin'];
        }

        var element = $('ul.g-fonts-list > [data-font="' + name + '"]');
        variants = variants || element.data('variants').split(',') || ['regular'];

        if (contains(variants, '400')) {
            removeAll(variants, '400');
            insert(variants, 'regular');
        }

        if (contains(variants, '400italic')) {
            removeAll(variants, '400italic');
            insert(variants, 'italic');
        }

        this.selected = {
            font: name,
            baseVariant: element.data('variant'),
            element: element,
            variants: variants,
            selected: [],
            local: isLocal,
            charsets: subset,
            availableVariants: element.data('variants').split(','),
            expanded: isLocal,
            loaded: isLocal
        };

        (isLocal ? [name] : variants).forEach(function(variant) {
            this.select(element, variant);
            variant = element.find('> ul > [data-variant="' + variant + '"]');
            if (variant) { variant.removeClass('g-variant-hide'); }
        }, this);

        var charsetSelected = element.find('.font-charsets-selected');
        if (charsetSelected) {
            var subsetsLength = element.data('subsets').split(',').length;
            charsetSelected.html('(<i class="fa fa-fw fa-check-square-o"></i>  <span class="font-charsets-details">' + subset.length + ' of ' + subsetsLength + '</span> selected)');
        }

        if (!isLocal) { $('ul.g-fonts-list')[0].scrollTop = element[0].offsetTop; }

        this.toggleExpansion();
        setTimeout(bind(function() { this.toggleExpansion(); }, this), 50);
        if (!isLocal) { setTimeout(bind(function() { $('ul.g-fonts-list')[0].scrollTop = element[0].offsetTop; }, this, 250)); }
    },

    select: function(element, variant/*, target*/) {
        var baseVariant = element.data('variant'),
            isLocal     = !baseVariant;

        if (!this.selected || this.selected.element != element) {
            if (variant && this.selected) {
                var charsetSelected = this.selected.element.find('.font-charsets-selected');
                if (charsetSelected) {
                    var subsetsLength = element.data('subsets').split(',').length;
                    charsetSelected.html('(<i class="fa fa-fw fa-check-square-o"></i>  <span class="font-charsets-details">1 of ' + subsetsLength + '</span> selected)');
                }
            }
            this.selected = {
                font: element.data('font'),
                baseVariant: baseVariant,
                element: element,
                variants: [baseVariant],
                selected: [],
                local: isLocal,
                charsets: ['latin'],
                availableVariants: element.data('variants').split(','),
                expanded: isLocal,
                loaded: isLocal
            };
        }

        if (!variant) {
            this.toggleExpansion();
        }


        if (variant || isLocal) {
            var selected = ($('ul.g-fonts-list > [data-font]:not([data-font="' + this.selected.font + '"]) input[type="checkbox"]:checked'));
            if (selected) {
                selected.checked(false);
                selected.parent('[data-variants]').removeClass('font-selected');
            }
            var checkbox = this.selected.element.find('input[type="checkbox"][value="' + (isLocal ? this.selected.font : variant) + '"]'),
                checked  = checkbox.checked();
            if (checkbox) {
                checkbox.checked(!checked);
            }

            if (!checked) {
                insert(this.selected.variants, variant);
                insert(this.selected.selected, variant);
            } else {
                if (variant != this.selected.baseVariant) { removeAll(this.selected.variants, variant); }
                removeAll(this.selected.selected, variant);
            }

            this.updateSelection();
        }
    },

    toggleExpansion: function() {
        if (this.selected.availableVariants.length <= 1) { return; }
        if (this.selected.local) {
            this.selected.expanded = true;
            return;
        }

        if (!this.selected.expanded) {
            var variants = this.selected.element.data('variants'), variant;
            if (variants.split(',').length > 1) {
                this.manipulateLink(this.selected.font);
                this.selected.element.search('[data-font]').removeClass('g-variant-hide');

                if (!this.selected.loaded) {
                    this.wf.load({
                        classes: false,
                        google: {
                            families: [this.selected.font.replace(/\s/g, '+') + ':' + variants]
                        },
                        fontactive: bind(function(family, fvd) {
                            var style  = this.fvdToStyle(family, fvd),
                                search = style.fontWeight;

                            if (search == '400') {
                                search = style.fontStyle == 'normal' ? 'regular' : 'italic';
                            } else if (style.fontStyle == 'italic') {
                                search += 'italic';
                            }

                            this.selected.element.find('li[data-variant="' + search + '"] .preview').style(style);
                            this.selected.loaded = true;
                        }, this)
                    });
                }
            }
        } else {
            var exclude = ':not([data-variant="' + this.selected.variants.join('"]):not([data-variant="') + '"])';
            exclude = this.selected.element.search('[data-font]' + exclude);
            if (exclude) { exclude.addClass('g-variant-hide'); }
        }

        this.selected.expanded = !this.selected.expanded;
    },

    manipulateLink: function(family) {
        family = family.replace(/\s/g, '+');
        var link = $('head link[href*="' + family + '"]');
        if (!link) { return; }

        var parts = decodeURIComponent(link.href()).split('|');
        if (!parts || parts.length <= 1) { return; }

        removeAll(parts, family);

        link.attribute('href', encodeURI(parts.join('|')));
    },

    toggle: function(event, element) {
        element = $(element);
        var target = $(event.target);

        if (target.attribute('type') == 'checkbox') {
            target.checked(!target.checked());
        }

        this.select(element.parent('[data-font]') || element, element.parent('[data-font]') ? element.data('variant') : false, element);

        return false;
    },

    updateSelection: function() {
        var preview = $('.g-particles-footer .font-selected'), selected, variants;
        if (!preview) { return; }

        if (!this.selected.selected.length) {
            preview.empty();
            this.selected.element.removeClass('font-selected');
            return;
        }

        selected = this.selected.selected.sort();
        variants = this.selected.local ? '(<small>local</small>)' : '(<small>' + selected.join(', ').replace('regular', 'normal') + '</small>)';
        this.selected.element.addClass('font-selected');
        preview.html('<strong>' + this.selected.font + '</strong> ' + variants);
    },

    updateTotal: function() {
        var totals = $('.g-particles-header .particle-search-total'),
            count  = $('.g-fonts-list > [data-font]:not(.g-font-hide)');

        totals.text(count ? count.length : 0);
    },

    updateCategories: function(container) {
        var categories = container.find('[data-font-categories]');
        if (!categories) { return; }

        this.filters.categories = categories.data('font-categories').split(',');
    },

    attachEvents: function(container) {
        var header  = container.find('.g-particles-header'),
            list    = container.find('.g-fonts-list'),
            search  = header.find('input.font-search'),
            preview = header.find('input.font-preview');

        decouple(list, 'scroll', bind(this.scroll, this, list));
        container.delegate('click', '.g-fonts-list li[data-font]', bind(this.toggle, this));

        if (search) { search.on('keyup', bind(this.search, this, search)); }
        if (preview) { preview.on('keyup', bind(this.updatePreview, this, preview)); }

        this.attachCharsets(container);
        this.attachLocalVariants(container);
        this.attachFooter(container);
    },

    attachCharsets: function(container) {
        container.delegate('mouseover', '.font-charsets-selected', bind(function(event, element) {
            if (!element.PopoverDefined) {
                var popover = element.getPopover({
                    placement: 'auto',
                    width: '200',
                    trigger: 'mouse',
                    style: 'font-categories, above-modal'
                });

                element.on('beforeshow.popover', bind(function(popover) {
                    var subsets = element.parent('[data-subsets]').data('subsets').split(','),
                        content = popover.$target.find('.g5-popover-content'),
                        checked;

                    content.empty();

                    var div, current;
                    subsets.forEach(function(cs) {
                        current = contains(this.selected.charsets, cs) ? (cs == 'latin' ? 'checked disabled' : 'checked') : '';
                        zen('div').html('<label><input type="checkbox" ' + current + ' value="' + cs + '"/> ' + properCase(unhyphenate(cs.replace('ext', 'extended'))) + '</label>').bottom(content);
                    }, this);

                    content.delegate('click', 'input[type="checkbox"]', bind(function(event, input) {
                        input = $(input);
                        checked = content.search('input[type="checkbox"]:checked');
                        this.selected.charsets = checked ? checked.map('value') : [];

                        element.html('(<i class="fa fa-fw fa-check-square-o"></i>  <span class="font-charsets-details">' + this.selected.charsets.length + ' of ' + subsets.length + '</span> selected)');
                    }, this));

                    popover.displayContent();
                }, this));

                element.getPopover().show();
            }
        }, this));
    },

    attachLocalVariants: function(container) {
        container.delegate('mouseover', '.g-font-variants-list', bind(function(event, element) {
            if (!element.PopoverDefined) {
                var popover = element.getPopover({
                    placement: 'auto',
                    width: '200',
                    trigger: 'mouse',
                    style: 'font-categories, above-modal'
                });

                element.on('beforeshow.popover', bind(function(popover) {
                    var content  = popover.$target.find('.g5-popover-content'),
                        variants = element.parent('[data-variants]').data('variants').split(',');

                    content.empty();

                    asyncForEach(variants, bind(function(variant) {
                        variant = variant == '400' ? 'regular' : (variant == '400italic' ? 'italic' : variant + '');
                        zen('div').text(this.mapVariant(variant)).bottom(content);
                    }, this));

                    popover.displayContent();
                }, this));
            }
        }, this));
    },

    attachFooter: function(container) {
        var footer     = container.find('.g-particles-footer'),
            select     = footer.find('button.button-primary'),
            categories = footer.find('.font-category'),
            subsets    = footer.find('.font-subsets'),
            current;

        select.on('click', bind(function() {
            if (!$('ul.g-fonts-list > [data-font] input[type="checkbox"]:checked')) {
                this.field.value('');
                modal.close();
                return;
            }

            var name      = this.selected.font.replace(/\s/g, '+'),
                variation = this.selected.selected,
                charset   = this.selected.charsets;

            if (variation.length == 1 && variation[0] == 'regular') { variation = []; }
            if (charset.length == 1 && charset[0] == 'latin') { charset = []; }

            if (contains(variation, 'regular')) {
                removeAll(variation, 'regular');
                insert(variation, '400');
            }
            if (contains(variation, 'italic')) {
                removeAll(variation, 'italic');
                insert(variation, '400italic');
            }

            if (!this.selected.local) {
                this.field.value('family=' + name + (variation.length ? ':' + variation.join(',') : '') + (charset.length ? '&subset=' + charset.join(',') : ''));
            } else {
                this.field.value(name);
            }

            this.field.emit('input');
            $('body').emit('input', { target: this.field });

            modal.close();
        }, this));

        categories.popover({
            placement: 'top',
            width: '200',
            trigger: 'mouse',
            style: 'font-categories, above-modal'
        }).on('beforeshow.popover', bind(function(popover) {
            var cats    = categories.data('font-categories').split(','),
                content = popover.$target.find('.g5-popover-content'),
                checked;

            content.empty();

            cats.forEach(function(category) {
                if (category == 'local-fonts') { return; }
                current = contains(this.filters.categories, category) ? 'checked' : '';
                zen('div').html('<label><input type="checkbox" ' + current + ' value="' + category + '"/> ' + properCase(unhyphenate(category)) + '</label>').bottom(content);
            }, this);

            content.delegate('click', 'input[type="checkbox"]', bind(function(event, input) {
                input = $(input);
                checked = content.search('input[type="checkbox"]:checked');
                this.filters.categories = checked ? checked.map('value') : [];
                categories.find('small').text(this.filters.categories.length);
                this.search();
            }, this));

            popover.displayContent();
        }, this));

        subsets.popover({
            placement: 'top',
            width: '200',
            trigger: 'mouse',
            style: 'font-subsets, above-modal'
        }).on('beforeshow.popover', bind(function(popover) {
            var subs    = subsets.data('font-subsets').split(','),
                content = popover.$target.find('.g5-popover-content');

            content.empty();

            var div;
            subs.forEach(function(sub) {
                current = sub == this.filters.script ? 'checked' : '';
                zen('div').html('<label><input name="font-subset[]" type="radio" ' + current + ' value="' + sub + '"/> ' + properCase(unhyphenate(sub.replace('ext', 'extended'))) + '</label>').bottom(content);
            }, this);

            content.delegate('change', 'input[type="radio"]', bind(function(event, input) {
                input = $(input);
                this.filters.script = input.value();
                $('.g-particles-header input.font-preview').value(this.previewSentence[this.filters.script]);
                subsets.find('small').text(properCase(unhyphenate(input.value().replace('ext', 'extended'))));
                this.search();
                this.updatePreview();
            }, this));

            popover.displayContent();
        }, this));

        return container;
    },

    search: function(input) {
        input = input || $('.g-particles-header input.font-search');
        var list  = $('.g-fonts-list'),
            value = input.value(),
            name, subsets, category, data;

        list.search('> [data-font]').forEach(function(font) {
            font = $(font);
            name = font.data('font');
            subsets = font.data('subsets').split(',');
            category = font.data('category');
            font.removeClass('g-font-hide');

            // We dont want to hide selected fonts
            if (this.selected && this.selected.font == name && this.selected.selected.length) { return; }

            // Filter by Subset
            if (!contains(subsets, this.filters.script)) {
                font.addClass('g-font-hide');
                return;
            }

            // Filter by Category
            if (!contains(this.filters.categories, category)) {
                font.addClass('g-font-hide');
                return;
            }

            // Filter by Name
            if (!name.match(new RegExp("^" + value + '|\\s' + value, 'gi'))) {
                font.addClass('g-font-hide');
            } else {
                font.removeClass('g-font-hide');
            }
        }, this);

        this.updateTotal();

        clearTimeout(input.refreshTimer);

        input.refreshTimer = setTimeout(bind(function() {
            this.scroll($('ul.g-fonts-list'));
        }, this), 400);

        input.previousValue = value;
    },

    updatePreview: function(input) {
        input = input || $('.g-particles-header input.font-preview');

        clearTimeout(input.refreshTimer);

        var value = input.value(),
            list  = $('.g-fonts-list');

        value = trim(value) ? trim(value) : this.previewSentence[this.filters.script];

        if (input.previousValue == value) { return true; }

        list.search('[data-font] .preview').text(value);

        input.previousValue = value;
    },

    fvdToStyle: function(family, fvd) {
        var match = fvd.match(/([a-z])([0-9])/);
        if (!match) return '';

        var styleMap = {
            n: 'normal',
            i: 'italic',
            o: 'oblique'
        };
        return {
            fontFamily: family,
            fontStyle: styleMap[match[1]],
            fontWeight: (match[2] * 100).toString()
        }
    },

    mapVariant: function(variant) {
        switch (variant) {
            case '100':
                return 'Thin 100';
                break;
            case '100italic':
                return 'Thin 100 Italic';
                break;
            case '200':
                return 'Extra-Light 200';
                break;
            case '200italic':
                return 'Extra-Light 200 Italic';
                break;
            case '300':
                return 'Light 300';
                break;
            case '300italic':
                return 'Light 300 Italic';
                break;
            case '400':
            case 'regular':
                return 'Normal 400';
                break;
            case '400italic':
            case 'italic':
                return 'Normal 400 Italic';
                break;
            case '500':
                return 'Medium 500';
                break;
            case '500italic':
                return 'Medium 500 Italic';
                break;
            case '600':
                return 'Semi-Bold 600';
                break;
            case '600italic':
                return 'Semi-Bold 600 Italic';
                break;
            case '700':
                return 'Bold 700';
                break;
            case '700italic':
                return 'Bold 700 Italic';
                break;
            case '800':
                return 'Extra-Bold 800';
                break;
            case '800italic':
                return 'Extra-Bold 800 Italic';
                break;
            case '900':
                return 'Ultra-Bold 900';
                break;
            case '900italic':
                return 'Ultra-Bold 900 Italic';
                break;
            default:
                return 'Unknown Variant';
        }
    }
});

domready(function() {
    var body = $('body');
    body.delegate('click', '[data-g5-fontpicker]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }
        var FontPicker = storage.get(element);
        if (!FontPicker) {
            FontPicker = new Fonts();
            storage.set(element, FontPicker);
        }

        FontPicker.open(event, element);
    });
});

module.exports = Fonts;

},{"../../ui":49,"../../utils/async-foreach":58,"../../utils/decouple":59,"../../utils/elements.utils":60,"../../utils/elements.viewport":61,"../../utils/get-ajax-suffix":64,"../../utils/get-ajax-url":65,"agent":71,"elements/domready":101,"elements/zen":106,"mout/array/append":133,"mout/array/combine":134,"mout/array/contains":135,"mout/array/find":140,"mout/array/forEach":143,"mout/array/insert":145,"mout/array/intersection":146,"mout/array/last":148,"mout/array/map":149,"mout/array/removeAll":150,"mout/array/split":153,"mout/function/bind":159,"mout/object/merge":203,"mout/string/properCase":229,"mout/string/trim":237,"mout/string/unhyphenate":240,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266,"prime/map":268,"webfontloader":274}],38:[function(require,module,exports){
"use strict";
var $             = require('../../utils/elements.utils'),
    domready      = require('elements/domready'),
    modal         = require('../../ui').modal,
    getAjaxSuffix = require('../../utils/get-ajax-suffix'),
    parseAjaxURI  = require('../../utils/get-ajax-url').parse,
    getAjaxURL    = require('../../utils/get-ajax-url').global,

    trim          = require('mout/string/trim'),
    contains      = require('mout/array/contains');

domready(function() {
    var body = $('body');
    body.delegate('keyup', '.g-icons input[type="text"]', function(event, element){
        element = $(element);
        var preview = element.sibling('[data-g5-iconpicker]') || element.siblings().find('[data-g5-iconpicker]'),
            value = element.value(),
            size;

        preview.find('i').attribute('class', value || 'fa fa-hand-o-up picker');

        size = preview[0].offsetWidth;

        if (!size) { preview.find('i').attribute('class', 'fa fa-hand-o-up picker'); }
    });

    body.delegate('click', '[data-g5-iconpicker]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }
        element = $(element);
        var field = $(element.data('g5-iconpicker')),
            realPreview = element,
            value = trim(field.value()).replace(/\s{2,}/g, ' ').split(' ');

        modal.open({
            content: 'Loading',
            className: 'g5-dialog-theme-default g5-modal-icons',
            remote: parseAjaxURI(getAjaxURL('icons') + getAjaxSuffix()),
            afterClose: function() {
                var popovers = $('.g5-popover');
                if (popovers) { popovers.remove(); }
            },
            remoteLoaded: function(response, content) {
                var html, large,
                    container = content.elements.content,
                    icons = container.search('[data-g-icon]');

                if (!icons || !response.body.success) {
                    container.html(response.body.html || response.body);
                    return false;
                }

                var updatePreview = function() {
                    var data = [],
                        active = container.find('[data-g-icon].active'),
                        options = container.search('.g-particles-header .float-right input:checked, .g-particles-header .float-right select');

                    if (active) { data.push(active.data('g-icon')); }
                    if (options) {
                        options.forEach(function(option) {
                            var v = $(option).value();
                            if (v && v !== 'fa-') { data.push(v); }
                        });
                    }

                    container.find('.g-icon-preview').html('<i class="fa ' + data.join(' ') + '"></i> <span>' + data[0] + '</span>');
                };

                var updateTotal = function() {
                    var total = container.search('[data-g-icon]:not(.hide-icon)');
                    container.find('.particle-search-total').text(total ? total.length : 0);
                };

                container.find('[data-g-select]').disabled(container.find('[data-g-icon].active') ? null : true);

                container.delegate('click', '[data-g-icon]', function(event, element) {
                    if (event && event.preventDefault) { event.preventDefault(); }
                    element = $(element);

                    var active = container.find('[data-g-icon].active');
                    if (active) { active.removeClass('active'); }

                    element.addClass('active');
                    container.find('[data-g-select]').disabled(null);

                    updatePreview();
                });

                container.delegate('click', '[data-g-select]', function(event){
                    event.preventDefault();

                    if (!container.find('[data-g-icon].active')) { return false; }

                    var output = container.find('.g-icon-preview i');
                    field.value(output.attribute('class'));
                    realPreview.find('i').attribute('class', output.attribute('class'));

                    field.emit('input');

                    $('body').emit('input', {target: field});

                    modal.close();
                });

                container.delegate('change', '.g-particles-header .float-right input[type="checkbox"], .g-particles-header .float-right select', function(/*e, input*/) {
                    updatePreview();
                });

                container.delegate('keyup', '.particle-search-wrapper input[type="text"]', function(e, input) {
                    input = $(input);
                    var value = input.value(),
                        hidden = container.search('[data-g-icon].hide-icon');

                    if (!value) {
                        if (hidden) {
                            hidden.removeClass('hide-icon');
                            updateTotal();
                        }
                        return true;
                    }

                    var found = container.search('[data-g-icon*="' + value + '"]');
                    container.search('[data-g-icon]').addClass('hide-icon');
                    if (found) {
                        found.removeClass('hide-icon');
                    }

                    updateTotal();

                });

                icons.forEach(function(icon) {
                    icon = $(icon);
                    html = '';
                    for (var i = 5, l = 0; i > l; i--) {
                        large = (!i) ? 'lg' : i + 'x';
                        html += '<i class="fa ' + icon.data('g-icon') + ' fa-' + large + '"></i> ';
                    }

                    icon.popover({
                        content: html,
                        placement: 'auto',
                        trigger: 'mouse',
                        style: 'above-modal, icons-preview',
                        width: 'auto',
                        targetEvents: false,
                        delay: 1
                    }).on('hidden.popover', function(instance) {
                        if (instance.$target) { instance.$target.remove(); }
                    });

                    if (contains(value, icon.data('g-icon'))) {
                        // set active icon
                        icon.addClass('active');

                        // toggle options
                        value.forEach(function(name) {
                            var field = container.find('[name="' + name + '"]');
                            if (field) { field.checked(true); }
                            else {
                                field = container.find('option[value="' + name + '"]');
                                if (field) { field.parent().value(name); }
                            }
                        });

                        // scroll into place of active icon
                        var wrap = icon.parent('.icons-wrapper'),
                            wrapHeight = wrap[0].offsetHeight;
                        wrap[0].scrollTop = icon[0].offsetTop - (wrapHeight / 2);

                        // update preview
                        updatePreview();
                    }
                });

                setTimeout(function() {
                    container.find('.particle-search-wrapper input')[0].focus();
                }, 5);
            }
        });
    });
});

module.exports = {};

},{"../../ui":49,"../../utils/elements.utils":60,"../../utils/get-ajax-suffix":64,"../../utils/get-ajax-url":65,"elements/domready":101,"mout/array/contains":135,"mout/string/trim":237}],39:[function(require,module,exports){
"use strict";

module.exports = {
    colorpicker: require('./colorpicker'),
    fonts: require('./fonts'),
    menu: require('./menu'),
    icons: require('./icons'),
    filepicker: require('./filepicker'),
    collections: require('./collections'),
    keyvalue: require('./keyvalue'),
    instancepicker: require('./instancepicker')
};
},{"./collections":34,"./colorpicker":35,"./filepicker":36,"./fonts":37,"./icons":38,"./instancepicker":40,"./keyvalue":41,"./menu":42}],40:[function(require,module,exports){
"use strict";

var $             = require('elements'),
    zen           = require('elements/zen'),
    ready         = require('elements/domready'),
    modal         = require('../../ui').modal,
    request       = require('agent'),
    trim          = require('mout/string/trim'),
    parseAjaxURI  = require('../../utils/get-ajax-url').parse,
    getAjaxURL    = require('../../utils/get-ajax-url').global,
    getAjaxSuffix = require('../../utils/get-ajax-suffix');


ready(function() {
    var body = $('body'),
        particleField = $('[data-g-instancepicker] ~ input[type="hidden"]'),
        moduleType = {
            wordpress: 'widget',
            joomla: 'module'
        };

    //if (particleField) {
        //particleField.on('change', function(){
        body.delegate('input', '[data-g-instancepicker] ~ input[type="hidden"]', function(event, element){
            if (!element.value()) {
                var title = element.siblings('.g-instancepicker-title'),
                    label = element.siblings('[data-g-instancepicker]'),
                    reset = element.sibling('.g-reset-field');

                title.text('');
                label.text(label.data('g-instancepicker-text'));
                reset.style('display', 'none');
            }
        });
    //}


    body.delegate('click', '[data-g-instancepicker]', function(event, element) {
        if (event) { event.preventDefault(); }

        var data = JSON.parse(element.data('g-instancepicker')),
            field = $('[name="' + data.field + '"]'),
            value, uri; // = 'particle' + ((data.type == moduleType[GANTRY_PLATFORM]) ? '/' + moduleType[GANTRY_PLATFORM] : ''),

        if (data.type == moduleType[GANTRY_PLATFORM]) {
            uri = (data.type != 'widget' ? 'particle/' : '') + moduleType[GANTRY_PLATFORM];
        } else {
            uri = 'particle';
        }

        if (!field) { return false; }

        value = field.value();

        if ((data.type == 'particle' || data.type == 'widget') && value) {
            value = JSON.parse(value || {});
            uri = value.type + '/' + value[data.type];
        }

        if (data.modal_close) { return true; }

        modal.open({
            content: 'Loading',
            method: !value || data.type == 'module' ? 'get' : 'post', // data.type == moduleType[GANTRY_PLATFORM]
            data: !value || data.type == 'module' ? {} : value, // data.type == moduleType[GANTRY_PLATFORM]
            remote: parseAjaxURI(getAjaxURL(uri) + getAjaxSuffix()),
            remoteLoaded: function(response, modalInstance) {
                var content = modalInstance.elements.content,
                    select = content.find('[data-mm-select]');

                var search = content.find('.search input'),
                    blocks = content.search('[data-mm-type]'),
                    filters = content.search('[data-mm-filter]');

                if (search && filters && blocks) {
                    search.on('input', function() {
                        if (!this.value()) {
                            blocks.removeClass('hidden');
                            return;
                        }

                        blocks.addClass('hidden');

                        var found = [], value = this.value().toLowerCase(), text;

                        filters.forEach(function(filter) {
                            filter = $(filter);
                            text = trim(filter.data('mm-filter')).toLowerCase();
                            if (text.match(new RegExp("^" + value + '|\\s' + value, 'gi'))) {
                                found.push(filter.matches('[data-mm-type]') ? filter : filter.parent('[data-mm-type]'));
                            }
                        }, this);

                        if (found.length) { $(found).removeClass('hidden'); }
                    });

                    setTimeout(function() {
                        search[0].focus();
                    }, 5);
                }

                var elementData = JSON.parse(element.data('g-instancepicker'));
                if (elementData.type == moduleType[GANTRY_PLATFORM]) { elementData.modal_close = true; }
                if (select) { select.data('g-instancepicker', JSON.stringify(elementData)); }
                else {
                    var form = content.find('form'),
                        fakeDOM = zen('div').html(response.body.html || response.body).find('form'),
                        submit = content.find('input[type="submit"], button[type="submit"]'),
                        dataString = [];

                    if ((!form && !fakeDOM) || !submit) { return true; }

                    var applyAndSave = content.search('[data-apply-and-save]');
                    if (applyAndSave) { applyAndSave.remove(); }

                    submit.on('click', function(e) {
                        e.preventDefault();
                        dataString = [];

                        submit.showIndicator();

                        $(fakeDOM[0].elements).forEach(function(input) {
                            input = $(input);
                            var name = input.attribute('name');
                            if (!name || input.disabled()) { return; }

                            input = content.find('[name="' + name + '"]');
                            var value = value = input.type() == 'checkbox' ? Number(input.checked()) : input.value(),
                                parent = input.parent('.settings-param'),
                                override = parent ? parent.find('> input[type="checkbox"]') : null;
                            override = override || $(input.data('override-target'));

                            if (override && !override.checked()) { return; }

                            if (input.type() != 'checkbox' || (input.type() == 'checkbox' && !!value)) {
                                dataString.push(name + '=' + encodeURIComponent(value));
                            }
                        });

                        var title = content.find('[data-title-editable]');
                        if (title) {
                            dataString.push('title=' + encodeURIComponent(title.data('title-editable')));
                        }

                        request(fakeDOM.attribute('method'), parseAjaxURI(fakeDOM.attribute('action') + getAjaxSuffix()), dataString.join('&') || {}, function(error, response) {
                            if (!response.body.success) {
                                modal.open({
                                    content: response.body.html || response.body,
                                    afterOpen: function(container) {
                                        if (!response.body.html) { container.style({ width: '90%' }); }
                                    }
                                });
                            } else {

                                var label = field.siblings('.g-instancepicker-title');

                                if (field) {
                                    field.value(JSON.stringify(response.body.item));
                                    $('body').emit('change', { target: field });
                                }

                                if (label) { label.text(response.body.item.title); }
                            }

                            modal.close();
                            submit.hideIndicator();
                        });
                    });

                }
            }
        });
    });
});

module.exports = {};

},{"../../ui":49,"../../utils/get-ajax-suffix":64,"../../utils/get-ajax-url":65,"agent":71,"elements":103,"elements/domready":101,"elements/zen":106,"mout/string/trim":237}],41:[function(require,module,exports){
"use strict";

var ready         = require('elements/domready'),
    $             = require('elements'),
    zen           = require('elements/zen'),
    has           = require('mout/object/has'),
    some          = require('mout/array/some'),
    modal         = require('../../ui').modal,
    toastr        = require('../../ui').toastr,
    request       = require('agent'),
    indexOf       = require('mout/array/indexOf'),
    contains      = require('mout/array/contains'),
    lastItem      = require('mout/array/last'),
    simpleSort    = require('sortablejs'),
    escapeUnicode = require('mout/string/escapeUnicode'),

    trim          = require('mout/string/trim'),

    getAjaxSuffix = require('../../utils/get-ajax-suffix');

require('elements/insertion');

ready(function() {
    var body = $('body');

    var createSortables = function(list) {
        var lists = list || $('.g-keyvalue-field ul');
        if (!lists) { return; }
        lists.forEach(function(list) {
            list = $(list);
            list.SimpleSort = simpleSort.create(list[0], {
                handle: '.fa-reorder',
                filter: '[data-keyvalue-nosort]',
                scroll: false,
                animation: 150,
                onStart: function() {
                    $(this.el).addClass('keyvalue-sorting');
                },
                onEnd: function(evt) {
                    var element = $(this.el);
                    element.removeClass('keyvalue-sorting');

                    if (evt.oldIndex === evt.newIndex) { return; }

                    var dataField = element.parent('.settings-param').find('[data-keyvalue-data]'),
                        data      = dataField.value();

                    data = JSON.parse(data);

                    data.splice(evt.newIndex, 0, data.splice(evt.oldIndex, 1)[0]);
                    dataField.value(JSON.stringify(data));
                    body.emit('change', { target: dataField });
                }
            });
        });
    };

    createSortables();

    // delegate sortables collections for ajax support
    body.delegate('mouseover', '.g-keyvalue-field ul', function(event, element) {
        if (!element.SimpleSort) { createSortables(element); }
    });

    // Add new item
    body.delegate('click', '[data-keyvalue-addnew]', function(event, element) {
        var param = element.parent('.settings-param'),
            list  = param.find('ul'),
            tmpl  = param.find('[data-keyvalue-template]'),
            items = list.search('> [data-keyvalue-item]') || [],
            last  = $(lastItem(items));

        var clone = $(tmpl[0].cloneNode(true));

        if (last) { clone.after(last); }
        else { clone.top(list); }

        clone.attribute('style', null).data('keyvalue-item', clone.data('keyvalue-template'));
        clone.attribute('data-keyvalue-template', null);
        clone.attribute('data-keyvalue-nosort', null);
        clone.find('[data-keyvalue-key]')[0].focus();

        //body.emit('change', { target: dataField });
    });

    // Remove item
    body.delegate('click', '[data-keyvalue-remove]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }
        var item      = element.parent('[data-keyvalue-item]'),
            key       = item.find('input[type="text"]').data('keyvalue-key'),
            dataField = element.parent('.settings-param').find('[data-keyvalue-data]'),
            items     = element.parent('ul').search('> [data-keyvalue-item]'),
            index     = indexOf(items, item[0]),
            data      = JSON.parse(dataField.value());

        data.splice(index, 1);
        dataField.value(escapeUnicode(JSON.stringify(data)));
        item.remove();

        body.emit('change', { target: dataField });
    });

    // Change values
    body.delegate('blur', '[data-keyvalue-item] input[type="text"]', function(event, element) {
        var parent     = element.parent('[data-keyvalue-item]'),
            wrapper    = parent.find('.g-keyvalue-wrapper'),
            keyElement = parent.find('[data-keyvalue-key]'),
            valElement = parent.find('[data-keyvalue-value]'),
            key        = keyElement.data('keyvalue-key'),
            keyValue   = trim(keyElement.value()),
            valValue   = trim(valElement.value()),
            items     = element.parent('ul').search('> [data-keyvalue-item]:not(.g-keyvalue-warning):not(.g-keyvalue-excluded)'),
            index     = indexOf(items, parent[0]),

            dataField  = element.parent('.settings-param').find('[data-keyvalue-data]'),
            data       = JSON.parse(dataField.value()),
            exclude    = JSON.parse(dataField.data('keyvalue-exclude')),
            excluded   = contains(exclude, keyValue),
            duplicate  = some(data, function(obj) { return has(obj, keyValue); }) && key !== keyValue;

        if (keyElement == element) {
            // renamed or cleared key, need to cleanup JSON
            if (key !== keyValue && !duplicate) {
                data.splice(index, 1);
                keyElement.data('keyvalue-key', keyValue || '');
            }

            parent[duplicate ? 'addClass' : 'removeClass']('g-keyvalue-warning');
            parent[excluded ? 'addClass' : 'removeClass']('g-keyvalue-excluded');

            wrapper
                .data('tip', duplicate ? 'The key "' + keyValue + '" is a duplicate' : (excluded ? 'The key "' + keyValue + '" has been excluded and cannot be used' : null))
                .data('tip-place', 'top-right')
                .data('tip-spacing', 2)
                .data('tip-offset', 8);

            if (excluded || duplicate) {
                window.G5.tips.get(wrapper[0]).show();
            } else {
                window.G5.tips.remove(wrapper[0]);
            }
        }

        if (keyValue && !excluded && !duplicate) {
            if (!data[index]) { data.splice(index, 0, {}); }
            data[index][keyValue] = valValue;
        }

        dataField.value(escapeUnicode(JSON.stringify(data)));
        body.emit('change', { target: dataField });

    }, true);

});

module.exports = {};

},{"../../ui":49,"../../utils/get-ajax-suffix":64,"agent":71,"elements":103,"elements/domready":101,"elements/insertion":104,"elements/zen":106,"mout/array/contains":135,"mout/array/indexOf":144,"mout/array/last":148,"mout/array/some":152,"mout/object/has":200,"mout/string/escapeUnicode":225,"mout/string/trim":237,"sortablejs":273}],42:[function(require,module,exports){
"use strict";
var $             = require('../../utils/elements.utils'),
    domready      = require('elements/domready');

domready(function() {
    var body = $('body');
    body.delegate('click', '[data-g5-content] .g-main-nav .g-toplevel [data-g5-ajaxify]', function(event, element) {
        if (event && event.preventDefault) { event.preventDefault(); }
        var items = $('[data-g5-content] .g-main-nav .g-toplevel [data-g5-ajaxify] !> li');
        if (items) { items.removeClass('active'); }
        element.parent('li').addClass('active');
    });
});

module.exports = {};
},{"../../utils/elements.utils":60,"elements/domready":101}],43:[function(require,module,exports){
"use strict";

var $             = require('elements'),
    zen           = require('elements/zen'),
    ready         = require('elements/domready'),
    trim          = require('mout/string/trim'),
    keys          = require('mout/object/keys'),
    modal         = require('../ui').modal,
    toastr        = require('../ui').toastr,
    request       = require('agent'),
    getAjaxSuffix = require('../utils/get-ajax-suffix'),
    parseAjaxURI  = require('../utils/get-ajax-url').parse,
    getAjaxURL    = require('../utils/get-ajax-url').global,

    flags         = require('../utils/flags-state');

ready(function() {
    var body = $('body'),
        warningURL = parseAjaxURI(getAjaxURL('confirmdeletion') + getAjaxSuffix());

    // Handles Positions Duplicate / Remove
    body.delegate('click', '#positions [data-g-config]', function(event, element) {
        var mode = element.data('g-config'),
            href = element.data('g-config-href'),
            encode = window.btoa(href),//.substr(-20, 20), // in case the strings gets too long
            method = (element.data('g-config-method') || 'post').toLowerCase();

        if (event && event.preventDefault) { event.preventDefault(); }

        if (mode == 'delete' && !flags.get('free:to:delete:' + encode, false)) {
            // confirm before proceeding
            flags.warning({
                url: warningURL,
                data: {page_type: 'POSITION'},
                callback: function(response, content) {
                    var confirm = content.find('[data-g-delete-confirm]'),
                        cancel  = content.find('[data-g-delete-cancel]');

                    if (!confirm) { return; }

                    confirm.on('click', function(e) {
                        e.preventDefault();
                        if (this.attribute('disabled')) { return false; }

                        flags.get('free:to:delete:' + encode, true);
                        $([confirm, cancel]).attribute('disabled');
                        body.emit('click', { target: element });

                        modal.close();
                    });

                    cancel.on('click', function(e) {
                        e.preventDefault();
                        if (this.attribute('disabled')) { return false; }

                        $([confirm, cancel]).attribute('disabled');
                        flags.get('free:to:delete:' + encode, false);

                        modal.close();
                    });
                }
            });

            return false;
        }

        element.hideIndicator();
        element.showIndicator();

        request(method, parseAjaxURI(href + getAjaxSuffix()), {}, function(error, response) {
            if (!response.body.success) {
                modal.open({
                    content: response.body.html || response.body,
                    afterOpen: function(container) {
                        if (!response.body.html) { container.style({ width: '90%' }); }
                    }
                });
            } else {
                var positionDeleted = response.body.position,
                    reload = $('[href="' + getAjaxURL('positions') + '"]');

                if (!reload) { window.location = window.location; }
                else {
                    body.emit('click', {target: reload});
                }

                toastr.success(response.body.html || 'Action successfully completed.', response.body.title || '');
                if (positionDeleted) {
                    body.positionDeleted = positionDeleted;
                }
            }

            element.hideIndicator();
        });

    });

    // Handles Positions Titles Rename
    var updateTitle = function(title, original, wasCanceled) {
            this.style('text-overflow', 'ellipsis');
            if (wasCanceled || title == original) { return; }
            var element = this,
                href = element.data('g-config-href'),
                method = (element.data('g-config-method') || 'post').toLowerCase(),
                parent = element.parent();

            parent.showIndicator();
            parent.find('[data-title-edit]').addClass('disabled');

            request(method, parseAjaxURI(href + getAjaxSuffix()), { title: trim(title) }, function(error, response) {
                if (!response.body.success) {
                    modal.open({
                        content: response.body.html || response.body,
                        afterOpen: function(container) {
                            if (!response.body.html) { container.style({ width: '90%' }); }
                        }
                    });

                    element.data('title-editable', original).text(original);
                } else {
                    element.data('title', title).data('tip', title);

                    // refresh ID label and actions buttons
                    var dummy = zen('div').html(response.body.position),
                        id = dummy.find('h4 span:last-child'),
                        actions = dummy.find('.position-actions');

                    element.parent('.card').find('h4 span:last-child').html(id.html());
                    element.parent('.card').find('.position-actions').html(actions.html());
                }

                parent.hideIndicator();
                parent.find('[data-title-edit]').removeClass('disabled');
            });
        },

        attachEditables = function(editables) {
            if (!editables || !editables.length) { return; }
            editables.forEach(function(editable) {
                editable = $(editable);
                editable.confWasAttached = true;
                editable.on('title-edit-start', function(){
                    editable.style('text-overflow', 'inherit');
                });
                editable.on('title-edit-end', updateTitle);
            });
        };

    body.on('statechangeAfter', function(event, element) {
        var editables = $('#positions [data-title-editable]');
        if (!editables) { return true; }

        editables = editables.filter(function(editable) {
            return (typeof $(editable).confWasAttached) === 'undefined';
        });

        attachEditables(editables);
    });

    attachEditables($('#positions [data-title-editable]'));
});

module.exports = {};

},{"../ui":49,"../utils/flags-state":63,"../utils/get-ajax-suffix":64,"../utils/get-ajax-url":65,"agent":71,"elements":103,"elements/domready":101,"elements/zen":106,"mout/object/keys":202,"mout/string/trim":237}],44:[function(require,module,exports){
"use strict";
var ready = require('elements/domready'),
    $ = require('elements/attributes'),
    modal = require('../ui').modal,
    contains = require('mout/array/contains'),
    forEach = require('mout/collection/forEach');

require('../ui/popover');

var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1,
    FOCUSIN   = isFirefox ? 'focus' : 'focusin';

ready(function() {

    var body = $('body');

    body.delegate('click', '[data-g-styles]', function(event, element) {
        var target = $(event.target);
        if (event && event.preventDefault) { event.preventDefault(); }
        if (target.hasClass('swatch-preview') || target.parent('.swatch-preview')) { return true; }

        var data = JSON.parse(element.data('g-styles')), input, value, type, evt;
        forEach(data, function(preset, name) {
            input = $('[name="' + name + '"]');
            value = input ? input.value() : false;

            if (!input || value === preset) { return; }

            evt = {
                target: input,
                forceOverride: true
            };

            type = (input.tag() == 'select' || contains(['hidden', 'checkbox'], input.type())) ? 'change' : 'input';

            input.value(preset);
            body.emit(type, evt);
            body.emit('keyup', evt);
        });
    });

    body.delegate('click', '[data-g-styles] .swatch-preview', function(event, element) {
        var image = element.parent('[data-g-styles]').find('img');
        if (!image) { return false; }

        modal.open({
            content: image[0].outerHTML,
            afterOpen: function(container) {
                var padding = parseInt(container.compute('padding-left'), 10) + parseInt(container.compute('padding-right'), 10);
                container.style({
                    maxWidth: '80%',
                    width: padding + (image[0].naturalWidth || image[0].width)
                });
            }
        });
    });

});

module.exports = {};

},{"../ui":49,"../ui/popover":51,"elements/attributes":98,"elements/domready":101,"mout/array/contains":135,"mout/collection/forEach":156}],45:[function(require,module,exports){
"use strict";
var ready  = require('elements/domready'),
    trim   = require('mout/string/trim'),
    forOwn = require('mout/object/forOwn'),
    $      = require('elements');

var Cookie = {
    write: function(name, value) {
        var date = new Date();
        date.setTime(date.getTime() + 3600 * 1000 * 24 * 365 * 10); // 10 years

        var host   = window.location.host.toString(),
            domain = host.substring(host.lastIndexOf(".", host.lastIndexOf(".") - 1) + 1);

        if (host.match(/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)) { domain = host; }
        var cookie = [name, '=', JSON.stringify(value), '; expires=', date.toGMTString(), '; domain=.', domain, '; path=/;'];

        document.cookie = cookie.join('');
    },

    read: function(name) {
        name = name.replace(/([-.*+?^${}()|[\]\/\\])/g, '\\$1');
        var value = document.cookie.match('(?:^|;)\\s*' + name + '=([^;]*)');
        return (value) ? JSON.parse(decodeURIComponent(value[1])) : null;
    }
};

var loadFromStorage = function() {
    var storage    = Cookie.read('g5-collapsed') || {},
        collapsers = $('[data-g-collapse]');
    if (!collapsers) { return false; }

    var item, data, handle, panel, card;
    forOwn(storage, function(value, key) {
        item = $('[data-g-collapse-id="' + key + '"]');
        if (!item) { return; }

        data = JSON.parse(item.data('g-collapse'));
        handle = data.handle ? item.find(data.handle) : item.find('.g-collapse');
        panel = data.target ? item.find(data.target) : item;
        card = item.parent('.card') || panel;
        handle
            .data('title', value ? data.expand : data.collapse)
            .data('tip', value ? data.expand : data.collapse);

        panel.attribute('style', null);
        card[!value ? 'removeClass' : 'addClass']('g-collapsed');
        item[!value ? 'removeClass' : 'addClass']('g-collapsed-main');
    });
};

ready(function() {
    var body = $('body'), data, target, storage;

    // single collapser
    body.delegate('click', '[data-g-collapse]', function(event, element) {
        element = event.element || element;

        data = JSON.parse(element.data('g-collapse'));
        target = $(event.target);
        storage = Cookie.read('g5-collapsed') || {};
        if (!data.handle) { data.handle = element.find('.g-collapse'); }

        if (!target.matches(data.handle) && !target.parent(data.handle)) { return false; }

        if (storage[data.id] === undefined) {
            storage[data.id] = data.collapsed;
            Cookie.write('g5-collapsed', storage);
        }

        var collapsed = storage[data.id],
            panel     = data.target ? element.find(data.target) : element,
            card      = panel.parent('.card') || panel;

        if (card && card.hasClass('g-collapsed')) {
            card.removeClass('g-collapsed');
            element.removeClass('g-collapsed-main');
            /* for animations
             panel.style({
             overflow: 'hidden',
             height: 0
             });*/
        }

        var slide = function(override) {
            collapsed = typeof override != 'number' ? override : collapsed;
            if (!collapsed) {
                card.addClass('g-collapsed');
                element.addClass('g-collapsed-main');
                element.attribute('style', null);
            }

            data.handle
                .data('title', !collapsed ? data.expand : data.collapse)
                .data('tip', !collapsed ? data.expand : data.collapse);
            storage[data.id] = !collapsed;
            data.collapsed = !collapsed;

            var refreshData = JSON.parse(element.data('g-collapse'));
            refreshData.collapsed = !collapsed;
            element.data('g-collapse', JSON.stringify(refreshData));

            Cookie.write('g5-collapsed', storage);
        };

        if (element.gFastCollapse) {
            panel[collapsed ? 'removeClass' : 'addClass']('g-collapsed');
            element[collapsed ? 'removeClass' : 'addClass']('g-collapsed-main');
            slide(collapsed);
        } else {
            element.removeClass('g-collapsed-main');
            // for animations
            // panel.removeClass('g-collapsed')[collapsed ? 'slideDown' : 'slideUp'](slide);
            panel.removeClass('g-collapsed')[collapsed ? 'removeClass' : 'addClass']('g-collapsed');
            slide(collapsed);
        }

        element.gFastCollapse = false;
    });

    // global collapse togglers
    body.delegate('click', '[data-g-collapse-all]', function(event, element) {
        var mode       = element.data('g-collapse-all') == 'true',
            parent     = element.parent('.g-filter-actions'),
            container  = parent.nextSibling(),
            collapsers = container.search('[data-g-collapse]'),
            storage    = Cookie.read('g5-collapsed') || {},
            panel, data, handle, card;

        if (!collapsers) { return; }

        collapsers.forEach(function(collapser) {
            collapser = $(collapser);
            card = collapser.parent('.card');
            data = JSON.parse(collapser.data('g-collapse'));
            handle = data.handle ? collapser.find(data.handle) : collapser.find('.g-collapse');
            panel = data.target ? collapser.find(data.target) : collapser;

            storage[data.id] = mode;
            Cookie.write('g5-collapsed', storage);


            panel.attribute('style', null);
            collapser[!mode ? 'removeClass' : 'addClass']('g-collapsed-main');
            card[!mode ? 'removeClass' : 'addClass']('g-collapsed');
        });
    });

    // filter by card title
    body.delegate('input', '[data-g-collapse-filter]', function(event, element) {
        var parent    = element.parent('.g-filter-actions'),
            container = parent.nextSibling(),
            cards     = container.search('.card'),
            value     = element.value();

        if (!cards) { return; }

        if (!value) { cards.attribute('style', null); }
        cards.forEach(function(element, index) {
            element = $(element);
            var title   = trim(element.find('h4 .g-title').text()),
                matches = title.match(new RegExp("^" + value + '|\\s' + value, 'gi'));

            if (matches) { element.attribute('style', null); }
            else { element.style('display', 'none'); }
        });
    });

    // this is now handled from the twig files
    // no need to run on domready
    //loadFromStorage();
});

module.exports = loadFromStorage;

},{"elements":103,"elements/domready":101,"mout/object/forOwn":198,"mout/string/trim":237}],46:[function(require,module,exports){
"use strict";

var prime      = require('prime'),
    Emitter    = require('prime/emitter'),
    Bound      = require('prime-util/prime/bound'),
    Options    = require('prime-util/prime/options'),
    bind       = require('mout/function/bind'),
    contains   = require('mout/array/contains'),
    DragEvents = require('./drag.events'),
    $          = require('../utils/elements.utils');

// $ utils
require('elements/events');
require('elements/delegation');

var isIE = (navigator.appName === "Microsoft Internet Explorer");

var DragDrop = new prime({

    mixin: [Bound, Options],
    inherits: Emitter,

    options: {
        delegate: null,
        droppables: false,
        catchClick: false
    },

    DRAG_EVENTS: DragEvents,

    constructor: function(container, options) {
        this.container = $(container);
        if (!this.container) { return; }
        this.setOptions(options);

        this.element = null;
        this.origin = {
            x: 0,
            y: 0,
            transform: null,
            offset: {
                x: 0,
                y: 0
            }
        };

        this.matched = false;
        this.lastMatched = false;
        this.lastOvered = null;

        this.attach();
    },

    attach: function() {
        this.DRAG_EVENTS.EVENTS.START.forEach(bind(function(event) {
            this.container.delegate(event, this.options.delegate, this.bound('start'));
        }, this));
    },

    detach: function() {
        this.DRAG_EVENTS.EVENTS.START.forEach(bind(function(event) {
            this.container.undelegate(event, this.options.delegate, this.bound('start'));
        }, this));
    },

    start: function(event, element) {
        //if (event && event.type.match(/^touch/i)) { event.preventDefault(); }

        clearTimeout(this.scrollInterval);
        if (element.LMTooltip) { element.LMTooltip.remove(); }
        $('html').attribute('style', 'height: 100% !important');
        this.scrollHeight = document.body.scrollHeight;

        // Prevents dragging a column from itself and limiting to its handle
        var target = $(event.target);
        if (!element.parent('[data-lm-root]') && element.hasClass('g-block') && (!target.matches('.submenu-reorder') && !target.parent('.submenu-reorder'))) { return true; }

        if (event.which && event.which !== 1 || $(event.target).matches(this.options.exclude)) { return true; }
        this.element = $(element);
        this.original = this.element;
        this.matched = false;
        if (this.options.catchClick) { this.moved = false; }

        // we force the menu column reorder handle to the g-block parent
        if (target.matches('.submenu-reorder') || target.parent('.submenu-reorder')) {
            this.element = target.parent('[data-mm-id]');
        }

        this.emit('dragdrop:beforestart', event, this.element);

        // Stops default MS touch actions since preventDefault doesn't work
        if (isIE) {
            this.element.style({
                '-ms-touch-action': 'none',
                'touch-action': 'none'
            });
        }

        // Stops text selection
        event.preventDefault();

        this.origin = {
            x: event.changedTouches ? event.changedTouches[0].pageX : event.pageX,
            y: event.changedTouches ? event.changedTouches[0].pageY : event.pageY,
            transform: this.element.compute('transform')
        };

        var clientRect = this.element[0].getBoundingClientRect();
        this.origin.offset = {
            clientRect: clientRect,
            scroll: {
                x: window.scrollX,
                y: window.scrollY
            },
            x: this.origin.x - clientRect.right,
            y: clientRect.top - this.origin.y
        };

        // Only allow to sort grids when targeting the left handle
        if (this.element.data('lm-blocktype') === 'grid' && Math.abs(this.origin.offset.x) < clientRect.width) {
            return false;
        }

        var offset  = Math.abs(this.origin.offset.x),
            columns = (this.element.parent().data('lm-blocktype') === 'grid' && this.element.parent().parent().data('lm-root')) ||
                (this.element.parent().parent().data('lm-blocktype') == 'container' && (this.element.parent().parent().parent().data('lm-root') || this.element.parent().parent().parent().data('lm-blocktype') == 'wrapper'));

        if (
            this.element.data('lm-blocktype') == 'grid' &&
            (this.element.parent().data('lm-blocktype') === 'container' && this.element.parent().parent().parent().data('lm-root')) ||
            (this.element.parent().data('lm-blocktype') === 'section' && this.element.parent().parent().parent().data('lm-root'))
        ) { columns = false; }

        // Resizing and only if it's not a non-visible (atoms) section
        if ((offset < 6 && this.element.parent().find(':last-child') !== this.element) || (columns && offset > 3 && offset < 10)) {
            if (this.element.parent('[data-lm-blocktype="atoms"]')) { return false; }

            this.emit('dragdrop:resize', event, this.element, (this.element.parent('[data-mm-id]') || this.element).siblings(':not(.placeholder)'), this.origin.offset.x);
            return false;
        }

        if (columns || (element.hasClass('submenu-column') && (!target.matches('.submenu-reorder') && !target.parent('.submenu-reorder')))) { return true; }

        this.element.style({
            'pointer-events': 'none',
            zIndex: 100
        });

        this.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
            $('body').on(event, this.bound('move'));
        }, this));

        this.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
            // Trackpads `tap` (mousedown + mouseup) happens too fast and the stop event
            // won't get attached. We need to defer it to avoid issues

            $('body').on(event, this.bound('deferStop'));
        }, this));

        this.emit('dragdrop:start', event, this.element);

        return this.element;
    },

    deferStop: function(event) {
        var self = this;
        setTimeout(function() {
            self.stop(event);
        }, 0);
    },

    stop: function(event) {
        //if (event && event.type.match(/^touch/i)) { event.preventDefault(); }

        clearTimeout(this.scrollInterval);
        $('html').attribute('style', null);
        if (!this.moved && this.options.catchClick) {
            // this is just a click
            this.element.style({ transform: this.origin.transform || 'translate(0, 0)' });
            this.emit('dragdrop:stop', event, this.matched, this.element);
            this._removeStyleAttribute(this.element);
            this.emit('dragdrop:stop:animation', this.element);
            this.emit('dragdrop:click', event, this.element);

            this.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
                $('body').off(event, this.bound('move'));
            }, this));

            this.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
                $('body').off(event, this.bound('deferStop'));
            }, this));

            this.element = null;

            return;
        }

        var settings = { duration: '250ms' };

        if (this.removeElement) {
            this.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
                $('body').off(event, this.bound('move'));
            }, this));

            this.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
                $('body').off(event, this.bound('deferStop'));
            }, this));

            return this.emit('dragdrop:stop:erase', event, this.element);
        }

        if (this.element) {

            this.emit('dragdrop:stop', event, this.matched, this.element);

            if (this.matched) {
                this.element.style({
                    opacity: 0,
                    transform: 'translate(0, 0)'
                }).removeClass('active');
            }

            if (!this.matched) {

                settings.callback = bind(function(element) {
                    this._removeStyleAttribute(element);
                    setTimeout(bind(function() {
                        this.emit('dragdrop:stop:animation', element);
                    }, this), 1);
                }, this, this.element);

                this.element.animate({
                    transform: this.origin.transform || 'translate(0, 0)',
                    opacity: 1
                }, settings);
            } else {

                this.element.style({
                    transform: this.origin.transform || 'translate(0, 0)',
                    opacity: 1
                });

                this._removeStyleAttribute(this.element);
                this.emit('dragdrop:stop:animation', this.element);
            }
        }

        this.DRAG_EVENTS.EVENTS.MOVE.forEach(bind(function(event) {
            $('body').off(event, this.bound('move'));
        }, this));

        this.DRAG_EVENTS.EVENTS.STOP.forEach(bind(function(event) {
            $('body').off(event, this.bound('deferStop'));
        }, this));

        this.element = null;
    },

    move: function(event) {
        //if (event && event.type.match(/^touch/i)) { event.preventDefault(); }

        if (this.options.catchClick) {
            var didItMove = {
                x: event.changedTouches ? event.changedTouches[0].pageX : event.pageX,
                y: event.changedTouches ? event.changedTouches[0].pageY : event.pageY
            };

            if (Math.abs(didItMove.x - this.origin.x) <= 3 && Math.abs(didItMove.y - this.origin.y) <= 3) {
                return;
            }

            if (!this.moved) {
                this.element.style({ opacity: 0.5 });
                this.emit('dragdrop:move:once', this.element);
            }

            this.moved = true;
        }

        var clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0,
            clientY = event.clientY || (event.touches && event.touches[0].clientY) || 0,
            overing = document.elementFromPoint(clientX, clientY),
            isGrid  = this.element.data('lm-blocktype') === 'grid';


        // Logic to auto-scroll on drag
        var scrollHeight = this.scrollHeight,
            Height       = document.body.clientHeight,
            Scroll       = window.pageYOffset;

        clearTimeout(this.scrollInterval);
        if (!overing) { return; }

        if (!$(overing).matches('#trash') && !$(overing).parent('#trash')) {
            var st, sl, trash = $('#g5-container #trash');
            if (clientY + 50 >= Height && Scroll + Height < scrollHeight) {
                this.scrollInterval = setInterval(function() {
                    sl = (window.pageXOffset || document.documentElement.scrollLeft) - (document.documentElement.clientLeft || 0);
                    st = (window.pageYOffset || document.documentElement.scrollTop) - (document.documentElement.clientTop || 0);
                    window.scrollTo(sl, Math.min(scrollHeight, st + 4));
                }, 8);
            } else if (clientY - 50 <= (trash ? trash[0].offsetHeight : 0) && scrollHeight > 0) {
                this.scrollInterval = setInterval(function() {
                    sl = (window.pageXOffset || document.documentElement.scrollLeft) - (document.documentElement.clientLeft || 0);
                    st = (window.pageYOffset || document.documentElement.scrollTop) - (document.documentElement.clientTop || 0);
                    window.scrollTo(sl, Math.max(0, st - 4));
                }, 8);
            }
        }

        // We tweak the overing to take into account the negative offset for the handle
        if (isGrid) {
            // More accurate is: clientX + (this.element[0].getBoundingClientRect().left - clientX)
            overing = document.elementFromPoint(clientX + 30, clientY);
        }

        if (!overing) { return false; }

        this.matched = $(overing).matches(this.options.droppables) ? overing : ($(overing).parent(this.options.droppables) || [false])[0];
        this.isPlaceHolder = $(overing).matches('[data-lm-placeholder]') ? true : ($(overing).parent('[data-lm-placeholder]') ? true : false);

        var deltaX    = this.lastX - clientX,
            deltaY    = this.lastY - clientY,
            direction = Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0 && 'left' ||
                Math.abs(deltaX) > Math.abs(deltaY) && deltaX < 0 && 'right' ||
                Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0 && 'up' ||
                'down';


        deltaX = (event.changedTouches ? event.changedTouches[0].pageX : event.pageX) - this.origin.x;
        deltaY = (event.changedTouches ? event.changedTouches[0].pageY : event.pageY) - this.origin.y;

        var isNew = this.element.parent('.particles-container');
        if (isNew) {
            deltaY += this.origin.offset.scroll.y - window.scrollY;
        }

        this.direction = direction;
        this.element.style({ transform: 'translate(' + deltaX + 'px, ' + deltaY + 'px)' });

        if (!this.isPlaceHolder) {
            if (this.lastMatched && this.matched !== this.lastMatched) {
                this.emit('dragdrop:leave', event, this.lastMatched, this.element);
                this.lastMatched = false;
            }

            if (this.matched && this.matched !== this.lastMatched && overing !== this.lastOvered) {
                this.emit('dragdrop:enter', event, this.matched, this.element);
                this.lastMatched = this.matched;
            }

            if (this.matched && this.lastMatched) {
                var rect = this.matched.getBoundingClientRect();
                // Note: you can divide x axis by 3 rather than 2 for 4 directions
                var location = {
                    x: Math.abs((clientX - rect.left)) < (rect.width / 2) && 'before' ||
                    Math.abs((clientX - rect.left)) >= (rect.width - (rect.width / 2)) && 'after' ||
                    'other',
                    y: Math.abs((clientY - rect.top)) < (rect.height / 2) && 'above' ||
                    Math.abs((clientY - rect.top)) >= (rect.height / 2) && 'below' ||
                    'other'
                };

                this.emit('dragdrop:location', event, location, this.matched, this.element);
            } else {
                this.emit('dragdrop:nolocation', event);
            }
        }

        this.lastOvered = overing;
        this.lastX = clientX;
        this.lastY = clientY;

        this.emit('dragdrop:move', event, this.element);
    },

    _removeStyleAttribute: function(element) {
        element = $(element || this.element);
        if (element.data('mm-id')) { return; }

        element.attribute('style', null);//.style({flex: flex});
    }

});

module.exports = DragDrop;

},{"../utils/elements.utils":60,"./drag.events":47,"elements/delegation":100,"elements/events":102,"mout/array/contains":135,"mout/function/bind":159,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266}],47:[function(require,module,exports){
"use strict";
var getSupportedEvent = function(events) {
    events = events.split(' ');

    var element = document.createElement('div'), event;
    var isSupported = false;

    for (var i = events.length - 1; i >= 0; i--) {
        event = 'on' + events[i];
        isSupported = (event in element);

        if (!isSupported) {
            element.setAttribute(event, 'return;');
            isSupported = typeof element[event] === 'function';
        }

        if (isSupported) {
            isSupported = events[i];
            break;
        }
    }

    element = null;
    return isSupported;
};

var getSupportedEvents = function(events) {
    events = events.split(' ');

    var isSupported = false, supported = [];
    for (var i = events.length - 1; i >= 0; i--) {
        isSupported = getSupportedEvent(events[i]);
        if (isSupported) { supported.push(isSupported); }
    }

    return supported;
};

var EVENT = {
        START: getSupportedEvent('mousedown touchstart MSPointerDown pointerdown'),
        MOVE: getSupportedEvent('mousemove touchmove MSPointerMove pointermove'),
        STOP: getSupportedEvent('mouseup touchend MSPointerUp pointerup')
    },
    EVENTS = {
        START: getSupportedEvents('mousedown touchstart MSPointerDown pointerdown'),
        MOVE: getSupportedEvents('mousemove touchmove MSPointerMove pointermove'),
        STOP: getSupportedEvents('mouseup touchend MSPointerUp pointerup')
    };


module.exports = {
    EVENT: EVENT,
    EVENTS: EVENTS
};

},{}],48:[function(require,module,exports){
"use strict";
var prime     = require('prime'),
    $         = require('../utils/elements.utils'),
    Emitter   = require('prime/emitter'),
    Bound     = require('prime-util/prime/bound'),
    Options   = require('prime-util/prime/options');


var Eraser = new prime({
    mixin: [Options, Bound],

    inherits: Emitter,

    constructor: function(element, options){
        this.setOptions(options);

        this.element = $(element);

        if (!this.element) { return; }

        this.hide(true);
    },

    setTop: function() {
        if (typeof this.top !== 'undefined') { return; }
        this.top = parseInt(this.element.compute('top'), 10);
        this.left = $('#g5-container')[0].getBoundingClientRect().left;
        if (GANTRY_PLATFORM == 'grav') {
            this.left = 0;
        }
    },

    show: function(fast){
        if (!this.element) { return; }
        this.setTop();
        this.out();
        this.element[fast ? 'style' : 'animate']({top: this.top, left: this.left}, {duration: '150ms'});
    },

    hide: function(fast){
        if (!this.element) { return; }
        this.setTop();
        this.element.style('display', 'block');
        var top = {top: -(this.element[0].offsetHeight)};
        this.out();
        this.element[fast ? 'style' : 'animate'](top, {duration: '150ms'});
    },

    over: function(){
        this.element.find('.trash-zone').animate({transform: 'scale(1.2)'}, {duration: '150ms', equation: 'cubic-bezier(0.5,0,0.5,1)'});
    },

    out: function(){
        this.element.find('.trash-zone').animate({transform: 'scale(1)'}, {duration: '150ms', equation: 'cubic-bezier(0.5,0,0.5,1)'});
    }
});

module.exports = Eraser;

},{"../utils/elements.utils":60,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266}],49:[function(require,module,exports){
"use strict";

var Selectize = require('./selectize');

module.exports = {
    modal: require('./modal'),
    togglers: require('./togglers'),
    collapse: require('./collapse'),
    selectize: Selectize,
    toastr: require('./toastr')
};

},{"./collapse":45,"./modal":50,"./selectize":53,"./toastr":54,"./togglers":55}],50:[function(require,module,exports){
"use strict";
// Based on Vex (https://github.com/hubspot/vex)

var prime    = require('prime'),
    $        = require('../utils/elements.utils'),
    zen      = require('elements/zen'),
    storage  = require('prime/map')(),
    Emitter  = require('prime/emitter'),
    Bound    = require('prime-util/prime/bound'),
    Options  = require('prime-util/prime/options'),
    domready = require('elements/domready'),

    bind     = require('mout/function/bind'),
    map      = require('mout/array/map'),
    forEach  = require('mout/array/forEach'),
    last     = require('mout/array/last'),
    merge    = require('mout/object/merge'),
    trim     = require('mout/string/trim'),

    request  = require('agent');

var animationEndSupport = false;

domready(function() {
    var style = (document.body || document.documentElement).style;

    forEach(['animation', 'WebkitAnimation', 'MozAnimation', 'MsAnimation', 'OAnimation'], function(animation, index) {
        if (animationEndSupport) {
            return;
        }
        animationEndSupport = style[animation] !== undefined ? Modal.prototype.animationEndEvent[index] : false;
    });
});

var Modal = new prime({
    mixin: [Bound, Options],

    inherits: Emitter,

    animationEndEvent: ['animationend', 'webkitAnimationEnd', 'mozAnimationEnd', 'MSAnimationEnd', 'oanimationend'],

    globalID: 1,

    options: {
        baseClassNames: {
            container: 'g5-dialog',
            content: 'g5-content',
            overlay: 'g5-overlay',
            close: 'g5-close',
            closing: 'g5-closing',
            open: 'g5-dialog-open'
        },

        content: '',
        remote: '',
        showCloseButton: true,
        escapeToClose: true,
        overlayClickToClose: true,
        appendNode: '#g5-container',
        className: 'g5-dialog-theme-default',
        css: {},
        overlayClassName: '',
        overlayCSS: '',
        contentClassName: '',
        contentCSS: '',
        closeClassName: 'g5-dialog-close',
        closeCSS: '',

        afterOpen: null,
        afterClose: null
    },

    constructor: function(options) {
        this.setOptions(options);
        this.defaults = this.options;

        var self = this;
        domready(function() {
            $(window).on('keydown', function(event) {
                if (event.keyCode === 27) {
                    return self.closeByEscape();
                }
            });

            self.animationEndEvent = animationEndSupport;
        });

        this
            .on('dialogOpen', function(options) {
                $('body').addClass(options.baseClassNames.open);
                $('html').addClass(options.baseClassNames.open);
            })
            .on('dialogAfterClose', bind(function(options) {
                var all = this.getAll();
                if (!all || !all.length) {
                    $('body').removeClass(options.baseClassNames.open);
                    $('html').removeClass(options.baseClassNames.open);
                }
            }, this));
    },

    storage: function() {
        return storage;
    },

    open: function(options) {
        options = merge(this.options, options);
        options.id = this.globalID++;

        var elements = {};

        // container
        elements.container = zen('div')
            .addClass(options.baseClassNames.container)
            .addClass(options.className)
            .style(options.css)
            .attribute('tabindex', '0')
            .attribute('role', 'dialog')
            .attribute('aria-hidden', 'true')
            .attribute('aria-labelledby', 'g-modal-labelledby')
            .attribute('aria-describedby', 'g-modal-describedby');

        storage.set(elements.container, { dialog: options });

        // overlay
        elements.overlay = zen('div')
            .addClass(options.baseClassNames.overlay)
            .addClass(options.overlayClassName)
            .style(options.overlayCSS);

        storage.set(elements.overlay, { dialog: options });

        if (options.overlayClickToClose) {
            elements.container.on('click', bind(this._overlayClick, this, elements.container[0]));
            elements.overlay.on('click', bind(this._overlayClick, this, elements.overlay[0]));
        }

        elements.container.appendChild(elements.overlay);

        // content
        elements.content = zen('div')
            .addClass(options.baseClassNames.content)
            .addClass(options.contentClassName)
            .style(options.contentCSS)
            .attribute('aria-live', 'assertive')
            .attribute('tabindex', '0')
            .html(options.content);

        storage.set(elements.content, { dialog: options });
        elements.container.appendChild(elements.content);

        if (options.overlayClickToClose) {
            elements.content.on('click', function(/*e*/){
                return true;
            });
        }

        // remote
        if (options.remote && options.remote.length > 1) {
            this.showLoading();

            options.method = options.method || 'get';
            var agent = request();
            agent.method(options.method);
            agent.url(options.remote);
            if (options.data) { agent.data(options.data); }

            agent.send(bind(function(error, response) {
                if (elements.container.hasClass(options.baseClassNames.closing)) {
                    this.hideLoading();
                    return;
                }

                elements.content.html(response.body.html || response.body);

                if (!response.body.success) {
                    if (!response.body.html) { elements.content.style({ width: '90%' }); }
                }

                this.hideLoading();
                if (options.remoteLoaded && !elements.container.hasClass(options.baseClassNames.closing)) {
                    options.remoteLoaded(response, options);
                }

                elements.container.attribute('aria-hidden', 'false');
                setTimeout(function(){ elements.content[0].focus(); }, 0);

                var selects = $('[data-selectize]');
                if (selects) { selects.selectize(); }
            }, this));
        } else {
            elements.container.attribute('aria-hidden', 'false');
            setTimeout(function(){ elements.content[0].focus(); }, 0);
        }

        // close button
        if (options.showCloseButton) {
            elements.closeButton = zen('div')
                .addClass(options.baseClassNames.close)
                .addClass(options.closeClassName)
                .attribute('role', 'button').attribute('aria-label', 'Close')
                .style(options.closeCSS);

            storage.set(elements.closeButton, { dialog: options });
            elements.content.appendChild(elements.closeButton);
        }

        // delegate container to pick g5-close clicks
        elements.container.delegate('click', '.g5-dialog-close', bind(function(event){
            event.preventDefault();
            this._closeButtonClick(elements.container);
        }, this));

        // inject the dialog in the DOM
        var container = $(options.appendNode);

        // wordpress workaround for out-of-scope cases
        if (GANTRY_PLATFORM == 'wordpress') {
            container = $('#customize-preview') || $('#widgets-right') || $(options.appendNode);
            if ('#' + container.id() != options.appendNode) {
                var wpwrap = $('#wpwrap') || $('.wp-customizer'), sibling, workaround;
                if (wpwrap.id() == 'wpwrap') {
                    sibling = wpwrap.nextSibling(options.appendNode);
                    workaround =  sibling ? sibling : zen('div.g5wp-out-of-scope' + options.appendNode).after(wpwrap);
                } else {
                    sibling = wpwrap.find('> ' + options.appendNode);
                    workaround =  sibling ? sibling : zen('div.g5wp-out-of-scope' + options.appendNode).top(wpwrap);
                }
                container = workaround;
            }
        }

        container.appendChild(elements.container);

        options.elements = elements;

        if (options.afterOpen) {
            options.afterOpen(elements.content, options);
        }

        setTimeout(bind(function() {
            return this.emit('dialogOpen', options);
        }, this), 0);

        return elements.content;
    },

    getAll: function() {
        var options = this.options;
        return $("." + options.baseClassNames.container + ":not(." + options.baseClassNames.closing + ") ." + options.baseClassNames.content);
    },

    getByID: function(id) {
        var all = this.getAll();
        if (!all) { return []; }

        return $(all.filter(function(element) {
            element = $(element);
            return storage.get(element).dialog.id === id;
        }));
    },

    close: function(id) {
        if (!id) {
            var element = $(last(this.getAll()));
            if (!element) {
                return false;
            }

            id = storage.get(element).dialog.id;
        }

        return this.closeByID(id);
    },

    closeAll: function() {
        var ids;

        ids = map(this.getAll(), function(element) {
            element = $(element);

            return storage.get(element).dialog.id;
        });

        if (!ids.length) {
            return false;
        }

        forEach(ids.reverse(), function(id) {
            return this.closeByID(id);
        }, this);

        return true;
    },

    closeByID: function(id) {
        var content = this.getByID(id);
        if (!content || !content.length) {
            return false;
        }

        var container, options;

        container = storage.get(content).dialog.elements.container;
        options = merge({}, storage.get(content).dialog);

        var beforeClose = function() {
                if (options.beforeClose) {
                    return options.beforeClose(content, options);
                }
            },
            close = bind(function() {
                if (options.remoteLoaded) { options.remoteLoaded = function(){}; }
                content.emit('dialogClose', options);
                container.remove();
                this.emit('dialogAfterClose', options);
                if (options.afterClose) {
                    return options.afterClose(content, options);
                }

            }, this);

        if (animationEndSupport) {
            beforeClose();
            container.off(this.animationEndEvent).on(this.animationEndEvent, function() {
                return close();
            }).addClass(options.baseClassNames.closing);
        } else {
            beforeClose();
            close();
        }

        return true;
    },

    closeByEscape: function() {
        var ids, id;

        ids = map(this.getAll(), function(element) {
            element = $(element);

            return storage.get(element).dialog.id;
        });

        if (!ids.length) {
            return false;
        }

        id = Math.max.apply(Math, ids);

        var element = this.getByID(id);

        if (!storage.get(element).dialog.escapeToClose) {
            return false;
        }

        return this.closeByID(id);

    },

    showLoading: function() {
        this.hideLoading();
        return $('#g5-container').appendChild(zen('div.g5-dialog-loading-spinner.' + this.options.className));
    },

    hideLoading: function() {
        var spinner = $('.g5-dialog-loading-spinner');
        return spinner ? spinner.remove() : false;
    },

    // private
    _overlayClick: function(element, event) {
        if (event.target !== element) {
            return;
        }

        return this.close(storage.get($(element)).dialog.id);
    },

    _closeButtonClick: function(element) {
        return this.close(storage.get($(element)).dialog.id);
    }
});

var modal = new Modal();

module.exports = modal;

},{"../utils/elements.utils":60,"agent":71,"elements/domready":101,"elements/zen":106,"mout/array/forEach":143,"mout/array/last":148,"mout/array/map":149,"mout/function/bind":159,"mout/object/merge":203,"mout/string/trim":237,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266,"prime/map":268}],51:[function(require,module,exports){
"use strict";

var prime    = require('prime'),
    $        = require('../utils/elements.utils'),
    zen      = require('elements/zen'),
    storage  = require('prime/map')(),
    Emitter  = require('prime/emitter'),
    Bound    = require('prime-util/prime/bound'),
    Options  = require('prime-util/prime/options'),
    domready = require('elements/domready'),

    bind     = require('mout/function/bind'),
    map      = require('mout/array/map'),
    forEach  = require('mout/array/forEach'),
    last     = require('mout/array/last'),
    merge    = require('mout/object/merge'),
    isFunct  = require('mout/lang/isFunction'),

    request  = require('agent');

var Popover = new prime({
    mixin: [Bound, Options],

    inherits: Emitter,

    options: {
        mainClass: 'g5-popover',
        placement: 'auto',
        width: 'auto',
        height: 'auto',
        trigger: 'click',
        style: '',
        delay: 300,
        cache: true,
        multi: false,
        arrow: true,
        title: '',
        content: '',
        closeable: false,
        padding: true,
        targetEvents: true,
        allowElementsClick: false,
        url: '',
        type: 'html',
        where: '#g5-container',
        template: '<div class="g5-popover">' +
        '<div class="g-arrow"></div>' +
        '<div class="g5-popover-inner">' +
        '<a href="#" class="close">x</a>' +
        '<h3 class="g5-popover-title"></h3>' +
        '<div class="g5-popover-content"><i class="icon-refresh"></i> <p>&nbsp;</p></div>' +
        '</div>' +
        '</div>'
    },

    constructor: function(element, options) {
        this.setOptions(options);
        this.element = $(element);

        if (this.options.trigger === 'click') {
            this.element.off('click', this.bound('toggle')).on('click', this.bound('toggle'));
        } else {
            this.element.off('mouseenter', this.bound('mouseenterHandler')).off('mouseleave', this.bound('mouseleaveHandler'))
                .on('mouseenter', this.bound('mouseenterHandler'))
                .on('mouseleave', this.bound('mouseleaveHandler'));
        }

        this._poped = false;
        //this._inited = true;
    },

    destroy: function() {
        this.hide();
        storage.set(this.element[0], null);
        this.element.off('click', this.bound('toggle')).off('mouseenter', this.bound('mouseenterHandler')).off('mouseleave', this.bound('mouseleaveHandler'));

        if (this.$target) {
            this.$target.remove();
        }
    },

    hide: function(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        //var e = $.Event('hide.' + pluginType);
        this.element.emit('hide.popover', this);
        if (this.$target) {
            this.$target.removeClass('in').style({ display: 'none' });
            this.$target.remove();
        }
        this.element.emit('hidden.popover', this);

        if (this._focusAttached) {
            $('body').off('focus', this.bound('focus'), true);
            this._focusAttached = false;
            this.restoreFocus();
        }
    },

    toggle: function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this[this.getTarget().hasClass('in') ? 'hide' : 'show']();
    },

    focus: function(e) {
        if (!this.getTarget().hasClass('in')) { return; }
        var self = this,
            target = $(e.target || e);

        if (
            this.$target[0] === target[0] || target.parent(this.$target) ||
            this.element[0] === target[0] || target.parent(this.element)
        ) { return; }

        this.hide();
        if (this._focusAttached) this.restoreFocus();
    },

    restoreFocus: function(element) {
        element = $(element || this.element);
        var tag = element.tag();

        setTimeout(function(){
            if (tag != 'a' && tag != 'input' && tag != 'button') {
                var items = element.find('a, button, input');
                if (items) items[0].focus();
            } else {
                element[0].focus();
            }
        }, 0);
    },

    hideAll: function(force) {
        var css = '';
        if (force) { css = 'div.' + this.options.mainClass; }
        else { css = 'div.' + this.options.mainClass + ':not(.' + this.options.mainClass + '-fixed)'; }

        var elements = $(css);
        if (!elements) { return this; }
        elements.removeClass('in').style({ display: 'none' }).attribute('tabindex', '-1');
        if (!force && this._focusAttached) this.restoreFocus();

        if (this._focusAttached) {
            $('body').off('focus', this.bound('focus'), true);
            this._focusAttached = false;
        }
        return this;
    },

    show: function() {
        var target = this.getTarget().attribute('class', null).addClass(this.options.mainClass).attribute('tabindex', '0');

        if (!this.options.multi) {
            this.hideAll();
        }

        // use cache by default, if not cache setted  , reInit the contents
        this.element.emit('beforeshow.popover', this);
        if (!this.options.cache || !this._poped) {
            this.setTitle(this.getTitle());

            if (!this.options.closeable) {
                target.find('.close').off('click').remove();
            }

            if (!this.isAsync()) {
                this.setContent(this.getContent());
            } else {
                this.setContentASync(this.options.content);
                this.displayContent();
                return;
            }

            target.style({ display: 'block' });
        }

        this.displayContent();
        this.bindBodyEvents();

        setTimeout(function(){
            target[0].focus();
        }, 0);

        if (!this._focusAttached) {
            $('body').on('focus', this.bound('focus'), true);
            this._focusAttached = true;
        }
    },

    displayContent: function() {
        var elementPos = this.element.position(),
            target = this.getTarget().attribute('class', null).addClass(this.options.mainClass),
            targetContent = this.getContentElement(),
            targetWidth, targetHeight, placement;

        this.element.emit('show.popover', this);

        if (this.options.width !== 'auto') {
            target.style({ width: this.options.width });
        }
        if (this.options.height !== 'auto') {
            targetContent.style({ height: this.options.height });
        }

        // init the popover and insert into the document body
        if (!this.options.arrow && target.find('.g-arrow')) {
            target.find('.g-arrow').remove();
        }

        var container = $(this.options.where);

        // wordpress workaround for out-of-scope cases
        if (GANTRY_PLATFORM == 'wordpress') {
            container = $('#customize-preview') || $('#widgets-right') || $(this.options.where);
            if ('#' + container.id() != this.options.where) {
                var wpwrap = $('#wpwrap') || $('.wp-customizer'), sibling, workaround;
                if (wpwrap.id() == 'wpwrap') {
                    sibling = wpwrap.nextSibling(this.options.where);
                    workaround =  sibling ? sibling : zen('div.g5wp-out-of-scope' + this.options.where).after(wpwrap);
                } else {
                    sibling = wpwrap.find('> ' + this.options.where);
                    workaround =  sibling ? sibling : zen('div.g5wp-out-of-scope' + this.options.where).top(wpwrap);
                }
                container = workaround;
            }
        }

        target.remove().style({
            top: -1000,
            left: -1000,
            display: 'block'
        }).bottom(container);

        if (this.options.style) {
            if (typeof this.options.style === 'string') {
                this.options.style = this.options.style.split(',').map(Function.prototype.call, String.prototype.trim);
            }

            this.options.style.forEach(function(style) {
                this.$target.addClass(this.options.mainClass + '-' + style);
            }, this);
        }

        if (!this.options.padding) {
            targetContent.css('height', targetContent.position().height);
            this.$target.addClass('g5-popover-no-padding');
        }

        targetWidth = target[0].offsetWidth;
        targetHeight = target[0].offsetHeight;
        placement = this.getPlacement(elementPos, targetHeight);
        if (this.options.targetEvents) { this.initTargetEvents(); }
        var positionInfo = this.getTargetPosition(elementPos, placement, targetWidth, targetHeight);
        this.$target.style(positionInfo.position).addClass(placement).addClass('in');

        if (this.options.type === 'iframe') {
            var iframe = target.find('iframe');
            iframe.style({
                width: target.position().width,
                height: iframe.parent().position.height
            });
        }

        if (!this.options.arrow) {
            this.$target.style({ 'margin': 0 });
        }
        if (this.options.arrow) {
            var arrow = this.$target.find('.g-arrow');
            arrow.attribute('style', null);
            if (positionInfo.arrowOffset) {
                arrow.style(positionInfo.arrowOffset);
            }
        }

        this._poped = true;
        this.element[0].focus();
        this.element.emit('shown.popover', this);

    },


    /*getter setters */
    getTarget: function() {
        if (!this.$target) {
            this.$target = $(zen('div').html(this.options.template).children()[0]);
        }
        return this.$target;
    },

    getTitleElement: function() {
        return this.getTarget().find('.' + this.options.mainClass + '-title');
    },

    getContentElement: function() {
        return this.getTarget().find('.' + this.options.mainClass + '-content');
    },

    getTitle: function() {
        return this.options.title || this.element.data('g5-popover-title') || this.element.attribute('title');
    },

    setTitle: function(title) {
        var element = this.getTitleElement();
        if (title) {
            element.html(title);
        }
        else {
            element.remove();
        }
    },

    hasContent: function() {
        return this.getContent();
    },

    getContent: function() {
        if (this.options.url) {
            if (this.options.type === 'iframe') {
                this.content = $('<iframe frameborder="0"></iframe>').attribute('src', this.options.url);
            }
        } else if (!this.content) {
            var content = '';
            if (isFunct(this.options.content)) {
                content = this.options.content.apply(this.element[0], arguments);
            } else {
                content = this.options.content;
            }
            this.content = this.element.data('g5-popover-content') || content;
        }
        return this.content;
    },

    setContent: function(content) {
        var target = this.getTarget();
        this.getContentElement().html(content);
        this.$target = target;
    },

    isAsync: function() {
        return this.options.type === 'async';
    },

    setContentASync: function(content) {
        request('get', this.options.url, bind(function(error, response) {
            if (content && isFunct(content)) {
                this.content = content.apply(this.element[0], [response]);
            } else {
                this.content = response.body.html;
            }

            this.setContent(this.content);

            var target = this.getContentElement();
            target.attribute('style', null);

            setTimeout(bind(function(){
                target.parent('.' + this.options.mainClass)[0].focus();
            }, this), 0);

            this.displayContent();
            this.bindBodyEvents();

            var selects = $('[data-selectize]');
            if (selects) { selects.selectize(); }
        }, this));
    },

    bindBodyEvents: function() {
        var body = $('body');
        body.off('keyup', this.bound('escapeHandler')).on('keyup', this.bound('escapeHandler'));
        body.off('click', this.bound('bodyClickHandler')).on('click', this.bound('bodyClickHandler'));
    },


    /* event handlers */
    mouseenterHandler: function() {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }
        if (!(this.getTarget()[0].offsetWidth > 0 || this.getTarget()[0].offsetHeight > 0)) {
            this.show();
        }
    },
    mouseleaveHandler: function() {
        // key point, set the _timeout  then use clearTimeout when mouse leave
        this._timeout = setTimeout(bind(function() {
            this.hide();
        }, this), this.options.delay);
    },

    escapeHandler: function(e) {
        if (e.keyCode === 27) {
            this.hideAll();
        }
    },

    bodyClickHandler: function() {
        this.hideAll();
    },

    targetClickHandler: function(e) {
        var target = $(e.target);
        if (target.matches(this.options.allowElementsClick)) { e.preventDefault(); }
        if (!target.parent('[data-g-popover-follow]') && target.data('g-popover-follow') === null) { e.stopPropagation(); }
    },

    initTargetEvents: function() {
        if (this.options.trigger !== 'click') {
            this.$target
                .off('mouseenter', this.bound('mouseenter'))
                .off('mouseleave', this.bound('mouseleave'))
                .on('mouseenter', this.bound('mouseenterHandler'))
                .on('mouseleave', this.bound('mouseleaveHandler'));
        }

        var close = this.$target.find('.close');
        if (close) {
            close.off('click', this.bound('hide')).on('click', this.bound('hide'));
        }

        this.$target.off('click', this.bound('targetClickHandler')).on('click', this.bound('targetClickHandler'));
    },

    /* utils methods */
    getPlacement: function(pos, targetHeight) {
        var
            placement,
            de = document.documentElement,
            db = document.body,
            clientWidth = de.clientWidth,
            clientHeight = de.clientHeight,
            scrollTop = Math.max(db.scrollTop, de.scrollTop),
            scrollLeft = Math.max(db.scrollLeft, de.scrollLeft),
            pageX = Math.max(0, pos.left - scrollLeft),
            pageY = Math.max(0, pos.top - scrollTop),
            arrowSize = 20;

        // if placement equals auto，caculate the placement by element information;
        if (typeof(this.options.placement) === 'function') {
            placement = this.options.placement.call(this, this.getTarget()[0], this.element[0]);
        } else {
            placement = this.element.data('g5-popover-placement') || this.options.placement;
        }

        if (placement === 'auto') {
            if (pageX < clientWidth / 3) {
                if (pageY < clientHeight / 3) {
                    placement = 'bottom-right';
                } else if (pageY < clientHeight * 2 / 3) {
                    placement = 'right';
                } else {
                    placement = 'top-right';
                }
                //placement= pageY>targetHeight+arrowSize?'top-right':'bottom-right';
            } else if (pageX < clientWidth * 2 / 3) {
                if (pageY < clientHeight / 3) {
                    placement = 'bottom';
                } else if (pageY < clientHeight * 2 / 3) {
                    placement = 'bottom';
                } else {
                    placement = 'top';
                }
            } else {
                placement = pageY > targetHeight + arrowSize ? 'top-left' : 'bottom-left';
                if (pageY < clientHeight / 3) {
                    placement = 'bottom-left';
                } else if (pageY < clientHeight * 2 / 3) {
                    placement = 'left';
                } else {
                    placement = 'top-left';
                }
            }
        }
        return placement;
    },

    getTargetPosition: function(elementPos, placement, targetWidth, targetHeight) {
        var pos = elementPos,
            elementW = this.element[0].offsetWidth,
            elementH = this.element[0].offsetHeight,
            position = {},
            arrowOffset = null,
            arrowSize = this.options.arrow ? 28 : 0,
            fixedW = elementW < arrowSize + 10 ? arrowSize : 0,
            fixedH = elementH < arrowSize + 10 ? arrowSize : 0;

        switch (placement) {
            case 'bottom':
                position = {
                    top: pos.top + pos.height,
                    left: pos.left + pos.width / 2 - targetWidth / 2
                };
                break;
            case 'top':
                position = {
                    top: pos.top - targetHeight,
                    left: pos.left + pos.width / 2 - targetWidth / 2
                };
                break;
            case 'left':
                position = {
                    top: pos.top + pos.height / 2 - targetHeight / 2,
                    left: pos.left - targetWidth
                };
                break;
            case 'right':
                position = {
                    top: pos.top + pos.height / 2 - targetHeight / 2,
                    left: pos.left + pos.width
                };
                break;
            case 'top-right':
                position = {
                    top: pos.top - targetHeight,
                    left: pos.left - fixedW
                };
                arrowOffset = { left: elementW / 2 + fixedW };
                break;
            case 'top-left':
                position = {
                    top: pos.top - targetHeight,
                    left: pos.left - targetWidth + pos.width + fixedW
                };
                arrowOffset = { left: targetWidth - elementW / 2 - fixedW };
                break;
            case 'bottom-right':
                position = {
                    top: pos.top + pos.height,
                    left: pos.left - fixedW
                };
                arrowOffset = { left: elementW / 2 + fixedW };
                break;
            case 'bottom-left':
                position = {
                    top: pos.top + pos.height,
                    left: pos.left - targetWidth + pos.width + fixedW
                };
                arrowOffset = { left: targetWidth - elementW / 2 - fixedW };
                break;
            case 'right-top':
                position = {
                    top: pos.top - targetHeight + pos.height + fixedH,
                    left: pos.left + pos.width
                };
                arrowOffset = { top: targetHeight - elementH / 2 - fixedH };
                break;
            case 'right-bottom':
                position = {
                    top: pos.top - fixedH,
                    left: pos.left + pos.width
                };
                arrowOffset = { top: elementH / 2 + fixedH };
                break;
            case 'left-top':
                position = {
                    top: pos.top - targetHeight + pos.height + fixedH,
                    left: pos.left - targetWidth
                };
                arrowOffset = { top: targetHeight - elementH / 2 - fixedH };
                break;
            case 'left-bottom':
                position = {
                    top: pos.top,
                    left: pos.left - targetWidth
                };
                arrowOffset = { top: elementH / 2 };
                break;

        }

        return {
            position: position,
            arrowOffset: arrowOffset
        };
    }

});

$.implement({
    getPopover: function(options) {
        var popover = storage.get(this);

        if (!popover && options !== 'destroy') {
            options = options || {};
            popover = new Popover(this, options);
            storage.set(this, popover);
            this.PopoverDefined = true;
        }

        return popover;
    },

    popover: function(options) {
        return this.forEach(function(element) {
            var popover = storage.get(element);

            if (!popover && options !== 'destroy') {
                options = options || {};
                popover = new Popover(element, options);
                storage.set(element, popover);
            }
        });
    },

    position: function() {
        var node = this[0],
            ct = $('#g5-container')[0].getBoundingClientRect(),
            box = {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            };

        if (typeof node.getBoundingClientRect !== "undefined") {
            box = node.getBoundingClientRect();
        }

        return {
            x: box.left - ct.left,
            left: box.left - ct.left,
            y: box.top - ct.top,
            top: box.top - ct.top,
            right: box.right - ct.right,
            bottom: box.bottom - ct.bottom,
            width: box.right - box.left,
            height: box.bottom - box.top
        };
    }
});

module.exports = $;

},{"../utils/elements.utils":60,"agent":71,"elements/domready":101,"elements/zen":106,"mout/array/forEach":143,"mout/array/last":148,"mout/array/map":149,"mout/function/bind":159,"mout/lang/isFunction":173,"mout/object/merge":203,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266,"prime/map":268}],52:[function(require,module,exports){
"use strict";

var $        = require('elements'),
    prime    = require('prime'),
    Emitter  = require('prime/emitter'),
    Bound    = require('prime-util/prime/bound'),
    Options  = require('prime-util/prime/options'),
    zen      = require('elements/zen'),
    moofx    = require('moofx'),

    bind     = require('mout/function/bind'),
    isArray  = require('mout/lang/isArray'),
    isNumber = require('mout/lang/isNumber');

var Progresser = new prime({

    mixin: [Bound, Options],

    inherits: Emitter,

    options: {
        value: 0.0,
        size: 50.0,
        startAngle: -Math.PI / 2,
        thickness: 'auto',
        fill: { // { color: 'hex|rgba' } || { gradient: [from, to], gradientAngle: Math.PI / 4, gradientDirection: [x0, y0, x1, y1] }
            gradient: ['#9e38eb', '#4e68fc']//['#3aeabb', '#fdd250']
        },
        emptyFill: 'rgba(0, 0, 0, .1)',
        animation: {
            duration: 1200,
            equation: 'cubic-bezier(0.645, 0.045, 0.355, 1)'
        },
        animationStartValue: 0.0,
        reverse: false,
        lineCap: 'butt', // butt, round, square
        insertElement: null,
        insertLocation: 'before'
    },

    constructor: function(element, options) {
        this.setOptions(options);

        this.element = this.element || $(element);
        this.canvas = this.canvas || zen('canvas')[this.options.insertLocation || 'before'](this.options.insertElement || this.element)[0];
        this.radius = this.options.size / 2;
        this.arcFill = null;
        this.lastFrameValue = 0.0;

        this.canvas.width = this.options.size;
        this.canvas.height = this.options.size;
        this.ctx = this.canvas.getContext('2d');

        this.initFill();
        this.draw();
    },

    initFill: function() {
        var fill = this.options.fill,
            size = this.options.size,
            ctx  = this.ctx;

        if (!fill) { throw Error('The fill is not specified.'); }

        if (fill.color) {
            this.arcFill = fill.color;
        }

        if (fill.gradient) {
            var gr = fill.gradient;

            if (gr.length == 1) { this.arcFill = gr[0]; }
            else {
                var ga = fill.gradientAngle || 0,  // gradient direction angle; 0 by default
                    gd = fill.gradientDirection || [
                            size / 2 * (1 - Math.cos(ga)), // x0
                            size / 2 * (1 + Math.sin(ga)), // y0
                            size / 2 * (1 + Math.cos(ga)), // x1
                            size / 2 * (1 - Math.sin(ga))  // y1
                        ],
                    lg = ctx.createLinearGradient.apply(ctx, gd);

                for (var i = 0; i < gr.length; i++) {
                    var color = gr[i],
                        pos   = i / (gr.length - 1);

                    if (isArray(color)) {
                        pos = color[1];
                        color = color[0];
                    }

                    lg.addColorStop(pos, color);
                }

                this.arcFill = lg;
            }
        }
    },

    draw: function() {
        this[this.options.animation ? 'drawAnimated' : 'drawFrame'](this.options.value);
    },

    drawFrame: function(v) {
        this.lastFrameValue = v;
        this.ctx.clearRect(0, 0, this.options.size, this.options.size);
        this.drawEmptyArc(v);
        this.drawArc(v);
    },

    drawArc: function(v) {
        var ctx = this.ctx,
            r   = this.radius,
            t   = this.getThickness(),
            a   = this.options.startAngle;

        ctx.save();
        ctx.beginPath();

        if (!this.options.reverse) {
            ctx.arc(r, r, r - t / 2, a, a + Math.PI * 2 * v);
        } else {
            ctx.arc(r, r, r - t / 2, a - Math.PI * 2 * v, a);
        }

        ctx.lineWidth = t;
        ctx.lineCap = this.options.lineCap;
        ctx.strokeStyle = this.arcFill;
        ctx.stroke();
        ctx.restore();
    },

    drawEmptyArc: function(v) {
        var ctx = this.ctx,
            r   = this.radius,
            t   = this.getThickness(),
            a   = this.options.startAngle;

        if (v < 1) {
            ctx.save();
            ctx.beginPath();

            if (v <= 0) {
                ctx.arc(r, r, r - t / 2, 0, Math.PI * 2);
            } else {
                if (!this.reverse) {
                    ctx.arc(r, r, r - t / 2, a + Math.PI * 2 * v, a);
                } else {
                    ctx.arc(r, r, r - t / 2, a, a - Math.PI * 2 * v);
                }
            }

            ctx.lineWidth = t;
            ctx.strokeStyle = this.options.emptyFill;
            ctx.stroke();
            ctx.restore();
        }
    },

    drawAnimated: function(v) {
        this.element.emit('progress-animation-start');

        moofx(bind(function(now) {
            var stepValue = this.options.animationStartValue * (1 - now) + v * now;
            this.drawFrame(stepValue);
            this.element.emit('progress-animation-change', now, stepValue);
        }, this), {
            duration: this.options.animation.duration || '1200',
            equation: this.options.animation.equation || 'linear',
            callback: bind(function() {
                if (this.options.animation.callback) { this.options.animation.callback(); }
                this.element.emit('progress-animation-end');
            }, this)
        }).start(0, 1);
    },

    getThickness: function() {
        return isNumber(this.options.thickness) ? this.options.thickness : this.options.size / 14;
    }
});

module.exports = Progresser;

},{"elements":103,"elements/zen":106,"moofx":107,"mout/function/bind":159,"mout/lang/isArray":171,"mout/lang/isNumber":175,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266}],53:[function(require,module,exports){
"use strict";
// selectize (v0.12.1)

var prime      = require('prime'),
    ready      = require('elements/domready'),
    zen        = require('elements/zen'),

    sifter     = require('sifter'),

    Emitter    = require('prime/emitter'),
    Bound      = require('prime-util/prime/bound'),
    Options    = require('prime-util/prime/options'),

    $          = require('../utils/elements.utils'),
    moofx      = require('moofx'),

    bind       = require('mout/function/bind'),
    forEach    = require('mout/collection/forEach'),
    indexOf    = require('mout/array/indexOf'),
    last       = require('mout/array/last'),
    debounce   = require('mout/function/debounce'),
    isArray    = require('mout/lang/isArray'),
    isBoolean  = require('mout/lang/isBoolean'),
    merge      = require('mout/object/merge'),
    unset      = require('mout/object/unset'),
    size       = require('mout/object/size'),
    values     = require('mout/object/values'),
    escapeHTML = require('mout/string/escapeHtml'),
    trim       = require('mout/string/trim'),
    slugify    = require('mout/string/slugify');


var IS_MAC                = /Mac/.test(navigator.userAgent),
    IS_IE                 = /MSIE 9/i.test(navigator.userAgent) || /MSIE 10/i.test(navigator.userAgent) || /rv:11.0/i.test(navigator.userAgent),
    COUNT                 = 0,

    KEY_A                 = 65,
    KEY_COMMA             = 188,
    KEY_RETURN            = 13,
    KEY_ESC               = 27,
    KEY_LEFT              = 37,
    KEY_UP                = 38,
    KEY_P                 = 80,
    KEY_RIGHT             = 39,
    KEY_DOWN              = 40,
    KEY_N                 = 78,
    KEY_BACKSPACE         = 8,
    KEY_DELETE            = 46,
    KEY_SHIFT             = 16,
    KEY_CMD               = IS_MAC ? 91 : 17,
    KEY_CTRL              = IS_MAC ? 18 : 17,
    KEY_TAB               = 9,

    TAG_SELECT            = 1,
    TAG_INPUT             = 2,

    // for now, android support in general is too spotty to support validity
    SUPPORTS_VALIDITY_API = !/android/i.test(window.navigator.userAgent) && !!document.createElement('form').validity;

var hash_key = function(value) {
    if (typeof value === 'undefined' || value === null) return null;
    if (typeof value === 'boolean') return value ? '1' : '0';
    return value + '';
};

var isset = function(object) {
    return typeof object !== 'undefined';
};

var escape_replace = function(str) {
    return (str + '').replace(/\$/g, '$$$$');
};

var once = function(fn) {
    var called = false;
    return function() {
        if (called) return;
        called = true;
        fn.apply(this, arguments);
    };
};

var debounce_events = function(self, types, fn) {
    var type;
    var trigger = self.emit;
    var event_args = {};

    // override trigger method
    self.emit = function() {
        var type = arguments[0];
        if (types.indexOf(type) !== -1) {
            event_args[type] = arguments;
        } else {
            return trigger.apply(self, arguments);
        }
    };

    // invoke provided function
    fn.apply(self, []);
    self.emit = trigger;

    // trigger queued events
    for (type in event_args) {
        if (event_args.hasOwnProperty(type)) {
            trigger.apply(self, event_args[type]);
        }
    }
};

var build_hash_table = function(key, objects) {
    if (!isArray(objects)) return objects;
    var i, n, table = {};
    for (i = 0, n = objects.length; i < n; i++) {
        if (objects[i].hasOwnProperty(key)) {
            table[objects[i][key]] = objects[i];
        }
    }
    return table;
};

var getSelection = function(input) {
    var result = {};
    if ('selectionStart' in input) {
        result.start = input.selectionStart;
        result.length = input.selectionEnd - result.start;
    } else if (document.selection) {
        input.focus();
        var sel = document.selection.createRange();
        var selLen = document.selection.createRange().text.length;
        sel.moveStart('character', -input.value.length);
        result.start = sel.text.length - selLen;
        result.length = selLen;
    }
    return result;
};

var transferStyles = function($from, $to, properties) {
    var i, n, styles = {};
    if (properties) {
        for (i = 0, n = properties.length; i < n; i++) {
            styles[properties[i]] = $from.compute(properties[i]);
        }
    } else {
        styles = $from.compute();
    }
    $to.style(styles);
};

var measured = null;
var measureString = function(str, $parent) {
    if (!str) {
        return 0;
    }

    var $test;
    if (!measured) {
        $test = zen('test').style({
            position: 'absolute',
            top: -99999,
            left: -99999,
            width: 'auto',
            padding: 0,
            whiteSpace: 'pre'
        }).text(str).bottom('body');

        transferStyles($parent, $test, [
            'letterSpacing',
            'fontSize',
            'fontFamily',
            'fontWeight',
            'textTransform'
        ]);

        measured = $test;
    } else {
        $test = measured;
        $test.text(str);
    }

    //var width = $test[0].offsetWidth;
    //$test.remove();

    return $test[0].offsetWidth;
};

var highlight = function($element, pattern) {
    if (typeof pattern === 'string' && !pattern.length) return;
    var regex = (typeof pattern === 'string') ? new RegExp(pattern, 'i') : pattern;

    var highlight = function(node) {
        var skip = 0;
        if (node.nodeType === 3) {
            var pos = node.data.search(regex);
            if (pos >= 0 && node.data.length > 0) {
                var match = node.data.match(regex);
                var spannode = document.createElement('span');
                spannode.className = 'g-highlight';
                var middlebit = node.splitText(pos);
                var endbit = middlebit.splitText(match[0].length);
                var middleclone = middlebit.cloneNode(true);
                spannode.appendChild(middleclone);
                middlebit.parentNode.replaceChild(spannode, middlebit);
                skip = 1;
            }
        } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName)) {
            for (var i = 0; i < node.childNodes.length; ++i) {
                i += highlight(node.childNodes[i]);
            }
        }
        return skip;
    };

    return forEach($element, function(el) {
        highlight(el);
    });
};

var autoGrow = function(input) {
    input = $(input);
    var currentWidth = null;

    var update = function(options, e) {
        var value, keyCode, printable, placeholder, width;
        var shift, character, selection;
        e = e || window.event || {};
        options = options || {};

        if (e.metaKey || e.altKey) return;
        if (!options.force && input.selectizeGrow === false) return;

        value = input.value();
        if (e.type && e.type.toLowerCase() === 'keydown') {
            keyCode = e.keyCode;
            printable = (
                (keyCode >= 97 && keyCode <= 122) || // a-z
                (keyCode >= 65 && keyCode <= 90) || // A-Z
                (keyCode >= 48 && keyCode <= 57) || // 0-9
                keyCode === 32 // space
            );

            if (keyCode === KEY_DELETE || keyCode === KEY_BACKSPACE) {
                selection = getSelection(input[0]);
                if (selection.length) {
                    value = value.substring(0, selection.start) + value.substring(selection.start + selection.length);
                } else if (keyCode === KEY_BACKSPACE && selection.start) {
                    value = value.substring(0, selection.start - 1) + value.substring(selection.start + 1);
                } else if (keyCode === KEY_DELETE && typeof selection.start !== 'undefined') {
                    value = value.substring(0, selection.start) + value.substring(selection.start + 1);
                }
            } else if (printable) {
                shift = e.shiftKey;
                character = String.fromCharCode(e.keyCode);
                if (shift) character = character.toUpperCase();
                else character = character.toLowerCase();
                value += character;
            }
        }

        placeholder = input.attribute('placeholder');
        if (!value && placeholder) {
            value = placeholder;
        }

        width = measureString(value, input) + 4;
        if (width !== currentWidth) {
            currentWidth = width;
            input[0].style.width = width + 'px';
            input.emit('resize');
        }
    };

    input.on('keydown', update);
    input.on('keyup', update);
    input.on('update', update);
    input.on('blur', update);

    update();
};

var Selectize = new prime({

    mixin: [Bound, Options],

    inherits: Emitter,

    options: {
        delimiter: ' ',
        splitOn: null, // regexp or string for splitting up values from a paste command
        persist: true,
        diacritics: true,
        create: false,
        createOnBlur: true,
        createFilter: null,
        highlight: true,
        openOnFocus: true,
        maxOptions: 1000,
        maxItems: null,
        hideSelected: null,
        addPrecedence: false,
        selectOnTab: false,
        preload: false,
        allowEmptyOption: false,
        closeAfterSelect: false,
        searchOnKeypress: true,

        scrollDuration: 60,
        loadThrottle: 300,
        loadingClass: 'g-loading',

        dataAttr: 'data-data',
        optgroupField: 'optgroup',
        valueField: 'value',
        labelField: 'text',
        optgroupLabelField: 'label',
        optgroupValueField: 'value',
        lockOptgroupOrder: false,

        sortField: '$order',
        searchField: ['text'],
        searchConjunction: 'and',

        mode: null,
        wrapperClass: 'g-selectize-control',
        inputClass: 'g-selectize-input',
        dropdownClass: 'g-selectize-dropdown',
        dropdownContentClass: 'g-selectize-dropdown-content',

        dropdownParent: null,

        copyClassesToDropdown: true,

        /*
         load            : null, // function(query, callback) { ... }
         score           : null, // function(search) { ... }
         onInitialize    : null, // function() { ... }
         onChange        : null, // function(value) { ... }
         onItemAdd       : null, // function(value, $item) { ... }
         onItemRemove    : null, // function(value) { ... }
         onClear         : null, // function() { ... }
         onOptionAdd     : null, // function(value, data) { ... }
         onOptionRemove  : null, // function(value) { ... }
         onOptionClear   : null, // function() { ... }
         onOptionGroupAdd     : null, // function(id, data) { ... }
         onOptionGroupRemove  : null, // function(id) { ... }
         onOptionGroupClear   : null, // function() { ... }
         onDropdownOpen  : null, // function($dropdown) { ... }
         onDropdownClose : null, // function($dropdown) { ... }
         onType          : null, // function(str) { ... }
         onDelete        : null, // function(values) { ... }
         */

        render: {
            /*
             item: null,
             optgroup: null,
             optgroup_header: null,
             option: null,
             option_create: null
             */
        }
    },

    constructor: function(input, options) {
        input = $(input);
        this.setOptions(options);

        // detect rtl environment
        var computedStyle = window.getComputedStyle && window.getComputedStyle(input[0], null);
        var dir = computedStyle ? computedStyle.getPropertyValue('direction') : input[0].currentStyle && input[0].currentStyle.direction;
        dir = dir || input.parents('[dir]:first').attr('dir') || '';

        this.rand = 'selectize-id-' + (Math.random() + 1).toString(36).substring(5);
        this.input = input;
        this.input.selectizeInstance = this;

        this.order = 0;
        this.tabIndex = input.attribute('tabindex') || '';
        this.tagType = input.tag() == 'select' ? TAG_SELECT : TAG_INPUT;
        this.rtl = /rtl/i.test(dir);
        this.highlightedValue = null;
        this.isRequired = input.attribute('required');
        forEach(['isOpen', 'isDisabled', 'isInvalid', 'isLocked', 'isFocused', 'isInputHidden', 'isSetup', 'isShiftDown', 'isCmdDown', 'isCtrlDown', 'ignoreFocus', 'ignoreBlur', 'ignoreHover', 'hasOptions'], function(option) {
            this[option] = false;
        }, this);
        this.currentResults = null;
        this.lastValue = '';
        this.caretPos = 0;
        this.loading = 0;
        this.loadedSearches = {};

        this.$activeOption = null;
        this.$activeItems = [];

        this.Optgroups = {};
        this.Options = {};
        this.UserOptions = {};
        this.items = [];
        this.renderCache = {};
        this.onSearchChange = this.options.loadThrottle === null ? this.onSearchChange : debounce(this.onSearchChange, this.options.loadThrottle);

        // search system
        this.sifter = new sifter(this.Options, { diacritics: this.options.diacritics });

        var i, n;

        // build options table
        if (this.options.Options) {
            for (i = 0, n = this.options.Options.length; i < n; i++) {
                this.registerOption(this.options.Options[i]);
            }
            delete this.options.Options;
        }

        // build optgroup table
        if (this.options.Optgroups) {
            for (i = 0, n = this.options.Optgroups.length; i < n; i++) {
                this.registerOptionGroup(this.options.Optgroups[i]);
            }
            delete this.options.Optgroups;
        }

        // option-demand defaults
        this.options.mode = this.options.mode || (this.options.maxItems === 1 ? 'single' : 'multi');
        if (!isBoolean(this.options.hideSelected)) { this.options.hideSelected = (this.options.mode === 'multi'); }

        this.setupCallbacks();
        this.setupTemplates();
        this.setup();

    },

    setup: function() {
        var $input = this.input,
            $wrapper,
            $control,
            $control_input,
            $dropdown,
            $dropdown_content,
            $dropdown_parent,
            inputMode,
            timeout_blur,
            timeout_focus,
            classes;

        inputMode = this.options.mode;
        classes = $input.attribute('class') || '';

        $wrapper = zen('div').addClass(this.options.wrapperClass).addClass(classes).addClass('g-' + inputMode).after(this.input);
        $control = zen('div').addClass(this.options.inputClass).addClass('g-items').bottom($wrapper);
        $control_input = zen('input[type="text"][autocomplete="off"][role="textbox"]').bottom($control).attribute('tabindex', $input.disabled() ? '-1' : this.tabIndex);
        $dropdown_parent = $(this.options.dropdownParent || $wrapper);
        $dropdown = zen('div').addClass(this.options.dropdownClass).addClass('g-' + inputMode).hide().bottom($dropdown_parent);
        $dropdown_content = zen('div[id="' + this.rand + '"]').addClass(this.options.dropdownContentClass).bottom($dropdown);

        if (this.options.copyClassesToDropdown) {
            $dropdown.addClass(classes);
        }

        if (inputMode == 'single') {
            $wrapper.style('width', parseInt($input[0].offsetWidth) + 12 + 24); // padding compensation
        }

        if ((this.options.maxItems === null || this.options.maxItems > 1) && this.tagType === TAG_SELECT) {
            $input.attribute('multiple', 'multiple');
        }

        if (this.options.placeholder) {
            $control_input.attribute('placeholder', this.options.placeholder);
        }

        // if splitOn was not passed in, construct it from the delimiter to allow pasting universally
        if (!this.options.splitOn && this.options.delimiter) {
            var delimiterEscaped = this.options.delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            this.options.splitOn = new RegExp('\\s*' + delimiterEscaped + '+\\s*');
        }

        if ($input.attribute('autocorrect')) {
            $control_input.attribute('autocorrect', $input.attribute('autocorrect'));
        }

        if ($input.attribute('autocapitalize')) {
            $control_input.attribute('autocapitalize', $input.attribute('autocapitalize'));
        }

        this.$wrapper = $wrapper;
        this.$control = $control;
        this.$control_input = $control_input;
        this.$dropdown = $dropdown;
        this.$dropdown_content = $dropdown_content;

        $dropdown.delegate('mouseover', '[data-selectable]', bind(function() { return this.onOptionHover.apply(this, arguments); }, this));
        $dropdown.delegate('mousedown', '[data-selectable]', bind(function() { return this.onOptionSelect.apply(this, arguments); }, this));
        $dropdown.delegate('click', '[data-selectable]', bind(function() { return this.onOptionSelect.apply(this, arguments); }, this));

        autoGrow($control_input);

        $control.delegate('mousedown', '*:not(input)', bind(function(event, element) {
            if (element == $control) { return true; }
            return this.onItemSelect.apply(this, arguments);
        }, this));

        $control.on('mousedown', bind(function() { return this.onMouseDown.apply(this, arguments); }, this));
        $control.on('click', bind(function() { return this.onClick.apply(this, arguments); }, this));
        $control.delegate('click', '.g-remove-single-item', bind(function() { return this.onItemRemoveViaX.apply(this, arguments); }, this));

        $control_input.on('mousedown', function(e) { e.stopPropagation(); });
        $control_input.on('keydown', bind(function() { return this.onKeyDown.apply(this, arguments); }, this));
        $control_input.on('keyup', bind(function() { return this.onKeyUp.apply(this, arguments); }, this));
        $control_input.on('keypress', bind(function() { return this.onKeyPress.apply(this, arguments); }, this));
        $control_input.on('resize', bind(function() { this.positionDropdown.apply(this, []); }, this));
        $control_input.on('blur', bind(function() { return this.onBlur.apply(this, arguments); }, this));
        $control_input.on('focus', bind(function() {
            this.ignoreBlur = false;
            return this.onFocus.apply(this, arguments);
        }, this));
        $control_input.on('paste', bind(function() { return this.onPaste.apply(this, arguments); }, this));

        $(document).on('keydown', bind(function(e) {
            this.isCmdDown = e[IS_MAC ? 'metaKey' : 'ctrlKey'];
            this.isCtrlDown = e[IS_MAC ? 'altKey' : 'ctrlKey'];
            this.isShiftDown = e.shiftKey;
        }, this));

        $(document).on('keyup', bind(function(e) {
            if (e.keyCode === KEY_CTRL) this.isCtrlDown = false;
            if (e.keyCode === KEY_SHIFT) this.isShiftDown = false;
            if (e.keyCode === KEY_CMD) this.isCmdDown = false;
        }, this));

        $(document).on('mousedown', bind(function(e) {
            if (this.isFocused) {
                // prevent events on the dropdown scrollbar from causing the control to blur
                if (e.target === this.$dropdown[0] || e.target.parentNode === this.$dropdown[0]) {
                    e.preventDefault();
                    return false;
                }
                // blur on click outside
                if (!this.$control.find($(e.target)) && e.target !== this.$control[0]) {
                    this.blur(e.target);
                }
            }
        }, this));

        $(window).on('scroll', bind(function() {
            if (this.isOpen) {
                this.positionDropdown.apply(this, arguments);
            }
        }, this));
        $(window).on('resize', bind(function() {
            if (this.isOpen) {
                this.positionDropdown.apply(this, arguments);
            }
        }, this));
        $(window).on('mousemove', bind(function() {
            this.ignoreHover = false;
        }, this));

        // store original children and tab index so that they can be
        // restored when the destroy() method is called.
        this.revertSettings = {
            $children: this.input.children(),//.detach(),
            tabindex: this.input.attribute('tabindex')
        };

        this.input.attribute('tabindex', -1).attribute('aria-hidden', true).hide().after($wrapper);

        if (isArray(this.options.items)) {
            this.setValue(this.options.items);
            delete this.options.items;
        }

        // feature detect for the validation API
        if (SUPPORTS_VALIDITY_API) {
            this.input.on('invalid', bind(function(e) {
                e.preventDefault();
                this.isInvalid = true;
                this.refreshState();
            }, this));
        }

        this.updateOriginalInput();
        this.refreshItems();
        this.refreshState();
        this.updatePlaceholder();
        this.isSetup = true;

        if (this.input.disabled()) {
            this.disable();
        }

        this.on('change', this.onChange);

        this.input.selectizeInstance = this;
        this.input.addClass('selectized');
        this.emit('initialize');

        // preload options
        if (this.options.preload === true) {
            this.onSearchChange('');
        }
        // ARIA
        $wrapper
            .attribute('role', 'combobox')
            .attribute('aria-autocomplete', 'list')
            .attribute('aria-haspopup', true)
            .attribute('aria-expanded', false)
            .attribute('aria-labelledby', this.rand + '-' + slugify(this.getValue()));

        $dropdown_content
            .attribute('role', 'tree')
            .attribute('aria-expanded', false)
            .attribute('aria-hidden', true);


    },

    setupTemplates: function() {
        var field_label    = this.options.labelField,
            field_optgroup = this.options.optgroupLabelField;

        var templates = {
            'optgroup': function(data) {
                return '<div class="g-optgroup">' + data.html + '</div>';
            },
            'optgroup_header': function(data, escape) {
                return '<div class="g-optgroup-header">' + escape(data[field_optgroup]) + '</div>';
            },
            'option': function(data, escape) {
                return '<div class="g-option">' + escape(data[field_label]) + '</div>';
            },
            'item': function(data, escape) {
                return '<div class="g-item" title="' + escape(data[field_label]) + '">' + escape(data[field_label]) + '<span  class="g-remove-single-item" tabindex="-1" title="Remove">&times;</span></div>';
            },
            'option_create': function(data, escape) {
                return '<div class="g-create">Add <strong>' + escape(data.input) + '</strong>&hellip;</div>';
            }
        };

        this.options.render = merge({}, templates, this.options.render);
    },

    setupCallbacks: function() {
        var key, fn, callbacks = {
            'initialize': 'onInitialize',
            'change': 'onChange',
            'item_add': 'onItemAdd',
            'item_remove': 'onItemRemove',
            'clear': 'onClear',
            'option_add': 'onOptionAdd',
            'option_remove': 'onOptionRemove',
            'option_clear': 'onOptionClear',
            'optgroup_add': 'onOptionGroupAdd',
            'optgroup_remove': 'onOptionGroupRemove',
            'optgroup_clear': 'onOptionGroupClear',
            'dropdown_open': 'onDropdownOpen',
            'dropdown_close': 'onDropdownClose',
            'type': 'onType',
            'load': 'onLoad',
            'focus': 'onFocus',
            'blur': 'onBlur'
        };

        for (key in callbacks) {
            if (callbacks.hasOwnProperty(key)) {
                fn = this.options[callbacks[key]];
                if (fn) { this.on(key, fn); }
            }
        }
    },



    onClick: function(e) {
        // necessary for mobile webkit devices (manual focus triggering
        // is ignored unless invoked within a click event)
        if (!this.isFocused) {
            this.focus();
            e.preventDefault();
        }
    },

    onMouseDown: function(e) {
        var defaultPrevented = e.defaultPrevented || (typeof e.defaultPrevented === 'undefined');
        var $target = $(e.target);

        if (this.isFocused) {
            // retain focus by preventing native handling. if the
            // event target is the input it should not be modified.
            // otherwise, text selection within the input won't work.
            if (e.target !== this.$control_input[0]) {
                if (this.options.mode === 'single') {
                    // toggle dropdown
                    this.isOpen ? this.close() : this.open();
                } else if (!defaultPrevented) {
                    this.setActiveItem(null);
                }

                /*e.preventDefault();
                e.stopPropagation();*/
                return false;
            }
        } else {
            // give control focus
            if (!defaultPrevented) {
                window.setTimeout(bind(function() {
                    this.focus();
                }, this), 0);
            }
        }
    },

    onChange: function() {
        this.input.emit('change', this.input.value(), this);
        $('body').emit('change', { target: this.input });
    },

    onPaste: function(e) {
        if (this.isFull() || this.isInputHidden || this.isLocked) {
            e.preventDefault();
        } else {
            // If a regex or string is included, this will split the pasted
            // input and create Items for each separate value
            if (this.options.splitOn) {
                setTimeout(bind(function() {
                    var splitInput = trim(this.$control_input.value() || '').split(this.options.splitOn);
                    for (var i = 0, n = splitInput.length; i < n; i++) {
                        this.createItem(splitInput[i]);
                    }
                }, this), 0);
            }
        }
    },

    onKeyPress: function(e) {
        if (this.isLocked) return e && e.preventDefault();
        var character = String.fromCharCode(e.keyCode || e.which);
        if (this.options.create && this.options.mode === 'multi' && character === this.options.delimiter) {
            this.createItem();
            e.preventDefault();
            return false;
        }
    },

    onKeyDown: function(e) {
        var isInput = e.target === this.$control_input[0];

        if (this.isLocked) {
            if (e.keyCode !== KEY_TAB) {
                e.preventDefault();
            }
            return;
        }

        switch (e.keyCode) {
            case KEY_A:
                if (this.isCmdDown) {
                    this.selectAll();
                    return;
                }
                break;
            case KEY_ESC:
                if (this.isOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.close();
                    //this.blur();
                }
                return;
            case KEY_N:
                if (!e.ctrlKey || e.altKey) break;
            case KEY_DOWN:
                if (!this.isOpen && this.hasOptions) {
                    this.open();
                } else if (this.$activeOption) {
                    this.ignoreHover = true;
                    var $next = this.getAdjacentOption(this.$activeOption, 1);
                    if ($next) { this.setActiveOption($next, true, true); }
                }
                e.preventDefault();
                return;
            case KEY_P:
                if (!e.ctrlKey || e.altKey) break;
            case KEY_UP:
                if (this.$activeOption) {
                    this.ignoreHover = true;
                    var $prev = this.getAdjacentOption(this.$activeOption, -1);
                    if ($prev) { this.setActiveOption($prev, true, true); }
                }
                e.preventDefault();
                return;
            case KEY_RETURN:
                if (this.isOpen && this.$activeOption) {
                    this.onOptionSelect({ currentTarget: this.$activeOption });
                    e.preventDefault();
                }
                return;
            case KEY_LEFT:
                this.advanceSelection(-1, e);
                return;
            case KEY_RIGHT:
                this.advanceSelection(1, e);
                return;
            case KEY_TAB:
                if (this.options.selectOnTab && this.isOpen && this.$activeOption) {
                    this.onOptionSelect({ currentTarget: this.$activeOption });

                    // Default behaviour is to jump to the next field, we only want this
                    // if the current field doesn't accept any more entries
                    if (!self.isFull()) {
                        e.preventDefault();
                    }
                }
                if (this.options.create && this.createItem()) {
                    e.preventDefault();
                }
                return;
            case KEY_BACKSPACE:
            case KEY_DELETE:
                this.deleteSelection(e);
                return;
        }

        if ((this.isFull() || this.isInputHidden) && !(IS_MAC ? e.metaKey : e.ctrlKey)) {
            e.preventDefault();
            return;
        }
    },

    onKeyUp: function(e) {

        if (this.isLocked) return e && e.preventDefault();
        var value = this.$control_input.value() || '';
        if (this.lastValue !== value) {
            this.lastValue = value;
            this.onSearchChange(value);
            this.refreshOptions();
            this.emit('type', value);
        }
    },

    onSearchChange: function(value) {
        var fn = this.options.load;
        if (!fn) return;
        if (this.loadedSearches.hasOwnProperty(value)) return;
        this.loadedSearches[value] = true;
        this.load(bind(function(callback) {
            fn.apply(this, [value, callback]);
        }, this));
    },

    onFocus: function(e) {
        var wasFocused = this.isFocused;

        if (this.isDisabled) {
            this.blur();
            e && e.preventDefault();
            return false;
        }

        if (this.ignoreFocus) return;
        this.isFocused = true;
        if (this.options.preload === 'focus') this.onSearchChange('');

        if (!wasFocused) this.emit('focus');

        if (!this.$activeItems.length) {
            this.showInput();
            this.setActiveItem(null);
            this.refreshOptions(!!this.options.openOnFocus);
        }

        this.refreshState();
    },

    onBlur: function(e, dest) {
        if (!this.isFocused) return;
        this.isFocused = false;

        if (this.ignoreFocus) {
            return;
        } else if (!this.ignoreBlur && (document.activeElement === this.$dropdown_content[0])) {
            // ^- g5 custom [before: no e.target && ..]
            // necessary to prevent IE closing the dropdown when the scrollbar is clicked
            this.ignoreBlur = true;
            this.onFocus(e);
            return;
        }

        var deactivate = bind(function() {
            this.close();
            this.setTextboxValue('');
            this.setActiveItem(null);
            this.setActiveOption(null);
            this.setCaret(this.items.length);
            this.refreshState();

            // IE11 bug: element still marked as active
            (dest || document.body).focus();

            this.ignoreFocus = false;
            this.emit('blur');

        }, this);

        this.ignoreFocus = true;
        if (this.options.create && this.options.createOnBlur) {
            this.createItem(null, false, deactivate);
        } else {
            deactivate();
        }
    },

    onOptionHover: function(e, element) {
        element = $(element);
        if (this.ignoreHover) return;
        this.setActiveOption(element || e.currentTarget, false);
    },

    onOptionSelect: function(e, element) {
        var value, $target, $option, self = this;

        if (e.preventDefault) {
            e.preventDefault();
            e.stopPropagation();
        }

        $target = $(element || e.currentTarget);
        if ($target.hasClass('g-create')) {
            this.createItem(null, bind(function() {
                if (this.options.closeAfterSelect) {
                    this.close();
                }
            }, this));
        } else {
            value = $target.attribute('data-value');
            if (typeof value !== 'undefined') {
                this.lastQuery = null;
                this.setTextboxValue('');
                this.addItem(value);
                if (this.options.closeAfterSelect) {
                    this.close();
                } else if (!this.options.hideSelected && e.type && /mouse/.test(e.type)) {
                    this.setActiveOption(this.getOption(value));
                }
            }
        }
    },

    onItemSelect: function(e, element) {
        if (this.isLocked) return;
        if (this.options.mode === 'multi') {
            e.preventDefault();
            this.setActiveItem(element || e.currentTarget, e);
        }
    },

    onItemRemoveViaX: function(e, element) {
        console.log(e, element);
        e.preventDefault();
        if (this.isLocked || this.options.mode == 'single') return;

        var $item = element.parent();
        this.setActiveItem($item);
        if (this.deleteSelection()) {
            this.setCaret(this.items.length);
        }
    },

    load: function(fn) {
        var $wrapper = this.$wrapper.addClass(this.options.loadingClass);

        this.loading++;
        fn.apply(this, [bind(function(results) {
            this.loading = Math.max(this.loading - 1, 0);
            if (results && results.length) {
                this.addOption(results);
                this.refreshOptions(this.isFocused && !this.isInputHidden);
            }
            if (!this.loading) {
                $wrapper.removeClass(this.options.loadingClass);
            }
            this.emit('load', results);
        }, this)]);
    },

    setTextboxValue: function(value) {
        var $input = this.$control_input;
        var changed = $input.value() !== value;
        if (changed) {
            $input.value(value).emit('update');
            this.lastValue = value;
        }
    },

    getValue: function(value) {
        // g5 custom
        if (this.tagType === TAG_SELECT && this.input.attribute('multiple')) {
            return value || this.items;
        } else {
            return (value || this.items).join(this.options.delimiter);
        }
    },

    setValue: function(value, silent) {
        var events = silent ? [] : ['change'];

        debounce_events(this, events, function() {
            this.clear(silent);
            this.previousValue = this.getValue() || value;
            this.addItems(value, silent);
        });
    },

    setActiveItem: function(item, e) {
        var eventName, idx, begin, end, $item, swap, $last;

        if (this.options.mode === 'single') { return; }
        item = $(item);

        // clear the active selection
        if (!item) {
            if (this.$activeItems.length) { $(this.$activeItems).removeClass('g-active'); }
            this.$activeItems = [];
            if (this.isFocused) {
                this.showInput();
            }
            return;
        }

        // modify selection
        eventName = e && e.type.toLowerCase();

        if (eventName === 'mousedown' && this.isShiftDown && this.$activeItems.length) {
            $last = $(last(this.$control.children('.g-active')));
            begin = Array.prototype.indexOf.apply(this.$control[0].childNodes, [$last[0]]);
            end = Array.prototype.indexOf.apply(this.$control[0].childNodes, [item[0]]);
            if (begin > end) {
                swap = begin;
                begin = end;
                end = swap;
            }
            for (var i = begin; i <= end; i++) {
                $item = this.$control[0].childNodes[i];
                if (this.$activeItems.indexOf($item) === -1) {
                    $($item).addClass('g-active');
                    this.$wrapper.attribute('aria-activedescendant', slugify(this.rand + '-' + $($item).attribute('data-value')));
                    this.$activeItems.push($item);
                }
            }
            e.preventDefault();
        } else if ((eventName === 'mousedown' && this.isCtrlDown) || (eventName === 'keydown' && this.isShiftDown)) {
            if (item.hasClass('g-active')) {
                idx = this.$activeItems.indexOf(item[0]);
                this.$activeItems.splice(idx, 1);
                item.removeClass('g-active');
            } else {
                this.$activeItems.push(item.addClass('g-active')[0]);
                this.$wrapper.attribute('aria-activedescendant', slugify(this.rand + '-' + item.attribute('data-value')));
            }
        } else {
            if ($(this.$activeItems)) $(this.$activeItems).removeClass('g-active');
            this.$activeItems = [item.addClass('g-active')[0]];
            this.$wrapper.attribute('aria-activedescendant', slugify(this.rand + '-' + item.attribute('data-value')));
        }

        // ensure control has focus
        this.hideInput();
        if (!this.isFocused) {
            this.focus();
        }
    },

    setActiveOption: function($option, scroll, animate) {
        var height_menu, height_item, y;
        var scroll_top, scroll_bottom;

        if (this.$activeOption) this.$activeOption.removeClass('g-active');
        this.$activeOption = null;

        $option = $($option);
        if (!$option) return;

        this.$activeOption = $option.addClass('g-active');
        this.$wrapper.attribute('aria-activedescendant', slugify(this.rand + '-' + $option.attribute('data-value')));

        if (scroll || !isset(scroll)) {

            height_menu = this.$dropdown_content[0].offsetHeight;
            height_item = this.$activeOption[0].offsetHeight;
            scroll = this.$dropdown_content[0].scrollTop || 0;
            y = this.$activeOption.position().top - this.$dropdown_content.position().top + scroll;
            scroll_top = y;
            scroll_bottom = y - height_menu + height_item;

            if (y + height_item > height_menu + scroll) {
                this.$dropdown_content[0].scrollTop = scroll_bottom;
                /*moofx(bind(function(value){
                 this.$dropdown_content[0].scrollTop = value;
                 }, this), {
                 duration: animate ? this.options.scrollDuration : 0,
                 equation: 'linear'
                 }).start(scroll, scroll_bottom);*/
            } else if (y < scroll) {
                this.$dropdown_content[0].scrollTop = scroll_top;
                /*moofx(bind(function(value){
                 this.$dropdown_content[0].scrollTop = value;
                 }, this), {
                 duration: animate ? this.options.scrollDuration : 0,
                 equation: 'linear'
                 }).start(scroll, scroll_top);*/
            }

        }
    },

    selectAll: function() {
        if (this.options.mode === 'single') return;

        var items = this.$control.children(':not(input)');
        if (items) {
            items.addClass('g-active');
            this.$wrapper.attribute('aria-activedescendant', slugify(this.rand + '-' + items.attribute('data-value')));
        }

        this.$activeItems = Array.prototype.slice.apply(items || []);
        if (this.$activeItems.length) {
            this.hideInput();
            this.close();
        }
        this.focus();
    },

    hideInput: function() {

        this.setTextboxValue('');
        this.$control_input.style({
            opacity: 0,
            position: 'absolute',
            left: this.rtl ? 10000 : -10000
        });
        this.isInputHidden = true;
    },

    showInput: function() {
        this.$control_input.style({
            opacity: 1,
            position: 'relative',
            left: 0
        });
        this.isInputHidden = false;
    },

    focus: function() {
        if (this.isDisabled) { return; }

        this.ignoreFocus = true;
        this.$control_input[0].focus();
        setTimeout(bind(function() {
            this.ignoreFocus = false;
            this.onFocus();
        }, this), 0);
    },

    blur: function(dest) {
        this.$control_input[0].blur();
        this.onBlur(null, dest);
        // g5 custom
        //this.$control_input[0].blur();
    },

    getScoreFunction: function(query) {
        return this.sifter.getScoreFunction(query, this.getSearchOptions());
    },

    getSearchOptions: function() {
        var sort = this.options.sortField;
        if (typeof sort === 'string') {
            sort = [{ field: sort }];
        }

        return {
            fields: this.options.searchField,
            conjunction: this.options.searchConjunction,
            sort: sort
        };
    },

    search: function(query) {
        var i, value, score, result, calculateScore;
        var options = this.getSearchOptions();

        // validate user-provided result scoring function
        if (this.options.score) {
            calculateScore = this.options.score.apply(this, [query]);
            if (typeof calculateScore !== 'function') {
                throw new Error('Selectize "score" setting must be a function that returns a function');
            }
        }

        // perform search
        if (query !== this.lastQuery) {
            this.lastQuery = query;
            result = this.sifter.search(query, merge(options, { score: calculateScore }));
            this.currentResults = result;
        } else {
            result = merge({}, this.currentResults);
        }

        // filter out selected items
        if (this.options.hideSelected) {
            for (i = result.items.length - 1; i >= 0; i--) {
                if (this.items.indexOf(hash_key(result.items[i].id)) !== -1) {
                    result.items.splice(i, 1);
                }
            }
        }

        return result;
    },

    refreshOptions: function(triggerDropdown) {
        var i, j, k, n, groups, groups_order, option, option_html, optgroup, optgroups, html, html_children, has_create_option;
        var $active, $active_before, $create;

        if (typeof triggerDropdown === 'undefined') {
            triggerDropdown = true;
        }

        var query = trim(this.$control_input.value());
        var results = this.search(query);
        var $dropdown_content = this.$dropdown_content;
        var active_before = this.$activeOption && hash_key(this.$activeOption.attribute('data-value'));

        // build markup
        n = results.items.length;
        if (typeof this.options.maxOptions === 'number') {
            n = Math.min(n, this.options.maxOptions);
        }

        // render and group available options individually
        groups = {};
        groups_order = [];

        // g5 custom
        //if (this.options.optgroupOrder) {
        //    groups_order = this.options.optgroupOrder;
        //    for (i = 0; i < groups_order.length; i++) {
        //        groups[groups_order[i]] = [];
        //    }
        //} else {
        //    groups_order = [];
        //}

        for (i = 0; i < n; i++) {
            option = this.Options[results.items[i].id];
            option_html = this.render('option', option);
            optgroup = option[this.options.optgroupField] || '';
            optgroups = isArray(optgroup) ? optgroup : [optgroup];

            for (j = 0, k = optgroups && optgroups.length; j < k; j++) {
                optgroup = optgroups[j];
                if (!this.Optgroups.hasOwnProperty(optgroup)) {
                    optgroup = '';
                }
                if (!groups.hasOwnProperty(optgroup)) {
                    groups[optgroup] = [];
                    groups_order.push(optgroup);
                }
                groups[optgroup].push(option_html);
            }
        }

        // sort optgroups
        if (this.options.lockOptgroupOrder) {
            groups_order.sort(function(a, b) {
                var a_order = this.Optgroups[a].$order || 0;
                var b_order = this.Optgroups[b].$order || 0;
                return a_order - b_order;
            });
        }

        // render optgroup headers & join groups
        html = [];
        for (i = 0, n = groups_order.length; i < n; i++) {
            optgroup = groups_order[i];
            if (this.Optgroups.hasOwnProperty(optgroup) && groups[optgroup].length) {
                // render the optgroup header and options within it,
                // then pass it to the wrapper template
                html_children = this.render('optgroup_header', this.Optgroups[optgroup]) || '';
                html_children += groups[optgroup].join('');
                html.push(this.render('optgroup', merge({}, this.Optgroups[optgroup], {
                    html: html_children
                })));
            } else {
                html.push(groups[optgroup].join(''));
            }
        }

        $dropdown_content.html(html.join(''));

        // highlight matching terms inline
        if (this.options.highlight && results.query.length && results.tokens.length) {
            for (i = 0, n = results.tokens.length; i < n; i++) {
                highlight($dropdown_content, results.tokens[i].regex);
            }
        }

        // add "selected" class to selected options
        if (!this.options.hideSelected) {
            for (i = 0, n = this.items.length; i < n; i++) {
                this.getOption(this.items[i]).addClass('g-selected').attribute('aria-selected', true);
            }
        }

        // add create option
        has_create_option = this.canCreate(query);
        if (has_create_option) {
            //$dropdown_content.prepend(this.render('option_create', { input: query }));
            $dropdown_content.html(this.render('option_create', { input: query }) + $dropdown_content.html());
            $create = $($dropdown_content[0].childNodes[0]);
        }

        // activate
        this.hasOptions = results.items.length > 0 || has_create_option;
        if (this.hasOptions) {
            if (results.items.length > 0) {
                $active_before = active_before && this.getOption(active_before);
                if ($active_before && $active_before.length) {
                    $active = $active_before;
                } else if (this.options.mode === 'single' && this.items.length) {
                    $active = this.getOption(this.items[0]);
                }
                if (!$active || !$active.length) {
                    if ($create && !this.options.addPrecedence) {
                        $active = this.getAdjacentOption($create, 1);
                    } else {
                        $active = $dropdown_content.find('[data-selectable]:first-child');
                    }
                }
            } else {
                $active = $create;
            }
            this.setActiveOption($active);
            if (triggerDropdown && !this.isOpen) { this.open(); }
        } else {
            this.setActiveOption(null);
            if (triggerDropdown && this.isOpen) { this.close(); }
        }
    },

    addOption: function(data) {
        var value;

        if (isArray(data)) {
            for (var i = 0, n = data.length; i < n; i++) {
                this.addOption(data[i]);
            }
            return;
        }

        if (value = this.registerOption(data)) {
            this.UserOptions[value] = true;
            this.lastQuery = null;
            this.emit('option_add', value, data);
        }

        // g5 custom
        /*value = hash_key(data[this.options.valueField]);
         if (typeof value !== 'string' || this.Options.hasOwnProperty(value)) return;

         this.UserOptions[value] = true;
         this.Options[value] = data;
         this.lastQuery = null;
         this.emit('option_add', value, data);*/
    },

    registerOption: function(data) {
        var key = hash_key(data[this.options.valueField]);
        if ((!key && !this.options.allowEmptyOption) || this.options.hasOwnProperty(key)) return false;
        data.$order = data.$order || ++this.order;
        this.Options[key] = data;

        return key;
    },

    registerOptionGroup: function(data) {
        var key = hash_key(data[this.options.optgroupValueField]);
        if (!key) return false;

        data.$order = data.$order || ++this.order;
        this.Optgroups[key] = data;

        return key;
    },


    addOptionGroup: function(id, data) {
        data[this.options.optgroupValueField] = id;
        if (id = this.registerOptionGroup(data)) {
            this.emit('optgroup_add', id, data);
        }
    },

    removeOptionGroup: function(id) {
        if (this.Optgroups.hasOwnProperty(id)) {
            delete this.Optgroups[id];
            this.renderCache = {};
            this.emit('optgroup_remove', id);
        }
    },

    clearOptionGroups: function() {
        this.Optgroups = {};
        this.renderCache = {};
        this.emit('optgroup_clear');
    },

    updateOption: function(value, data) {
        var self = this;
        var $item, $item_new, dummy;
        var value_new, index_item, cache_items, cache_options, order_old;

        value = hash_key(value);
        value_new = hash_key(data[this.options.valueField]);

        // sanity checks
        if (value === null) return;
        if (!this.Options.hasOwnProperty(value)) return;
        if (typeof value_new !== 'string') throw new Error('Value must be set in option data');

        order_old = this.Options[value].$order;

        // update references
        if (value_new !== value) {
            delete this.Options[value];
            index_item = this.items.indexOf(value);
            if (index_item !== -1) {
                this.items.splice(index_item, 1, value_new);
            }
        }
        data.$order = data.$order || order_old;
        this.Options[value_new] = data;

        // invalidate render cache
        cache_items = this.renderCache['item'];
        cache_options = this.renderCache['option'];

        if (cache_items) {
            delete cache_items[value];
            delete cache_items[value_new];
        }
        if (cache_options) {
            delete cache_options[value];
            delete cache_options[value_new];
        }

        // update the item if it's selected
        if (this.items.indexOf(value_new) !== -1) {
            $item = this.getItem(value);
            var dummy = zen('div').html(this.render('item', data));
            $item_new = dummy.firstChild();
            if ($item.hasClass('g-active')) {
                $item_new.addClass('g-active');
                this.$wrapper.attribute('aria-activedescendant', slugify(this.rand + '-' + $item_new.attribute('data-value')));
            }

            $item_new.after($item);
            $item.remove();
        }

        // invalidate last query because we might have updated the sortField
        this.lastQuery = null;

        // update dropdown contents
        if (this.isOpen) {
            this.refreshOptions(false);
        }
    },

    removeOption: function(value, silent) {
        value = hash_key(value);

        var cache_items = this.renderCache['item'];
        var cache_options = this.renderCache['option'];
        if (cache_items) delete cache_items[value];
        if (cache_options) delete cache_options[value];

        delete this.UserOptions[value];
        delete this.Options[value];
        this.lastQuery = null;
        this.emit('option_remove', value);
        this.removeItem(value, silent);
    },

    clearOptions: function() {
        this.loadedSearches = {};
        this.UserOptions = {};
        this.renderCache = {};
        this.Options = this.sifter.items = {};
        this.lastQuery = null;
        this.emit('option_clear');
        this.clear();
    },

    getOption: function(value) {
        return this.getElementWithValue(value, this.$dropdown_content.search('[data-selectable]'));
    },

    getAdjacentOption: function($option, direction) {
        var $options = this.$dropdown.search('[data-selectable]');
        var index = indexOf($options, ($option ? $option[0] : null)) + direction;

        return index >= 0 && index < ($options ? $options.length : 0) ? $($options[index]) : $();
    },

    getElementWithValue: function(value, $els) {
        value = hash_key(value);

        if (typeof value !== 'undefined' && value !== null) {
            for (var i = 0, n = ($els ? $els.length : 0); i < n; i++) {
                if ($els[i].getAttribute('data-value') === value) {
                    return $($els[i]);
                }
            }
        }

        return $();
    },

    getItem: function(value) {
        return this.getElementWithValue(value, this.$control.children());
    },

    addItems: function(values, silent) {
        var items = isArray(values) ? values : [values];
        for (var i = 0, n = items.length; i < n; i++) {
            this.isPending = (i < n - 1);
            this.addItem(items[i], silent);
        }
    },

    addItem: function(value, silent) {
        var events = silent ? [] : ['change'];

        debounce_events(this, events, function() {
            var $item, $option, $options;
            var inputMode = this.options.mode;
            var i, active, value_next, wasFull;
            value = hash_key(value);

            if (this.items.indexOf(value) !== -1) {
                // g5 custom [before: && this.isOpen]
                if (inputMode === 'single') this.close();
                return;
            }

            if (!this.Options.hasOwnProperty(value)) return;
            if (inputMode === 'single') this.clear(silent);
            if (inputMode === 'multi' && this.isFull()) return;

            var dummy = zen('div').html(this.render('item', this.Options[value]));
            $item = dummy.firstChild();
            if (inputMode !== 'multi') $item.find('.g-remove-single-item').remove();

            // ARIA
            $item.attribute('id', this.rand + '-' + slugify($item.attribute('data-value')));
            if (inputMode === 'multi') $item.attribute('aria-selected', true);

            wasFull = this.isFull();
            this.items.splice(this.caretPos, 0, value);
            this.insertAtCaret($item);
            if (!this.isPending || (!wasFull && this.isFull())) {
                this.refreshState();
            }

            if (this.isSetup) {
                $options = this.$dropdown_content.search('[data-selectable]');

                // update menu / remove the option (if this is not one item being added as part of series)
                if (!this.isPending) {
                    $option = this.getOption(value);
                    var adj = this.getAdjacentOption($option, 1);
                    value_next = (adj) ? adj.attribute('data-value') : null;
                    this.refreshOptions(this.isFocused && inputMode !== 'single');
                    if (value_next) {
                        this.setActiveOption(this.getOption(value_next));
                    }
                }

                // hide the menu if the maximum number of items have been selected or no options are left
                if (!$options || this.isFull()) {
                    this.close();
                } else {
                    this.positionDropdown();
                }

                this.updatePlaceholder();
                this.emit('item_add', value, $item);
                this.updateOriginalInput({ silent: silent });
            }
        });
    },

    removeItem: function(value, silent) {
        var $item, i, idx;

        $item = (typeof value === 'object') ? value : this.getItem(value);
        value = hash_key($item.attribute('data-value'));
        i = this.items.indexOf(value);

        if (i !== -1) {
            $item.remove();
            if ($item.hasClass('g-active')) {
                idx = this.$activeItems.indexOf($item[0]);
                this.$activeItems.splice(idx, 1);
            }

            this.items.splice(i, 1);
            this.lastQuery = null;
            if (!this.options.persist && this.UserOptions.hasOwnProperty(value)) {
                this.removeOption(value, silent);
            }

            if (i < this.caretPos) {
                this.setCaret(this.caretPos - 1);
            }

            this.refreshState();
            this.updatePlaceholder();
            this.updateOriginalInput({ silent: silent });
            this.positionDropdown();
            this.emit('item_remove', value, $item);
        }
    },

    createItem: function(input, triggerDropdown) {
        var caret = this.caretPos;
        input = input || trim(this.$control_input.value() || '');

        var callback = arguments[arguments.length - 1];
        if (typeof callback !== 'function') callback = function() {};

        if (!isBoolean(triggerDropdown)) {
            triggerDropdown = true;
        }

        if (!this.canCreate(input)) {
            callback();
            return false;
        }

        this.lock();

        var setup = (typeof this.options.create === 'function') ? this.options.create : bind(function(input) {
            var data = {};
            data[this.options.labelField] = input;
            data[this.options.valueField] = input;
            return data;
        }, this);

        var create = once(bind(function(data) {
            this.unlock();

            if (!data || typeof data !== 'object') return callback();
            var value = hash_key(data[this.options.valueField]);
            if (typeof value !== 'string') return callback();

            this.setTextboxValue('');
            this.addOption(data);
            this.setCaret(caret);
            this.addItem(value);
            this.refreshOptions(triggerDropdown && this.options.mode !== 'single');
            callback(data);
        }, this));

        var output = setup.apply(this, [input, create]);
        if (typeof output !== 'undefined') {
            create(output);
        }

        return true;
    },

    refreshItems: function() {
        this.lastQuery = null;

        if (this.isSetup) {
            this.addItem(this.items);
        }

        this.refreshState();
        this.updateOriginalInput();
    },

    refreshState: function() {
        var invalid;
        if (this.isRequired) {
            if (this.items.length) this.isInvalid = false;
            this.$control_input.attribute('required', this.isInvalid || null);
        }
        this.refreshClasses();
    },

    refreshClasses: function() {
        var isFull   = this.isFull(),
            isLocked = this.isLocked;

        this.$wrapper.toggleClass('g-rtl', this.rtl);

        this.$control.toggleClass('g-focus', this.isFocused);
        this.$control.toggleClass('g-disabled', this.isDisabled);
        this.$control.toggleClass('g-required', this.isRequired);
        this.$control.toggleClass('g-invalid', this.isInvalid);
        this.$control.toggleClass('g-locked', isLocked);
        this.$control.toggleClass('g-full', isFull);
        this.$control.toggleClass('g-not-full', !isFull);
        this.$control.toggleClass('g-input-active', this.isFocused && !this.isInputHidden);
        this.$control.toggleClass('g-dropdown-active', this.isOpen);
        this.$control.toggleClass('g-has-options', !size(this.options.Options));
        this.$control.toggleClass('g-has-items', this.items.length > 0);

        // ARIA
        if (this.isOpen) {
            this.$wrapper
                .attribute('aria-owns', this.rand)
                .attribute('aria-activedescendant', slugify(this.rand + '-' + this.getValue()))
                .attribute('aria-expanded', true);

            this.$dropdown_content
                .attribute('aria-expanded', true)
                .attribute('aria-hidden', false);
        } else {
            this.$wrapper
                .attribute('aria-owns', null)
                .attribute('aria-activedescendant', null)
                .attribute('aria-expanded', false);

            this.$dropdown_content
                .attribute('aria-expanded', false)
                .attribute('aria-hidden', true);
        }

        this.$control_input.selectizeGrow = !isFull && !isLocked;
    },

    isFull: function() {
        return this.options.maxItems !== null && this.items.length >= this.options.maxItems;
    },

    updateOriginalInput: function(opts) {
        var options, label;
        opts = opts || {};

        if (this.tagType === TAG_SELECT) {
            options = [];
            for (var i = 0, n = this.items.length; i < n; i++) {
                label = this.Options[this.items[i]][this.options.labelField] || '';
                options.push('<option value="' + escapeHTML(this.items[i]) + '" selected="selected">' + escapeHTML(label) + '</option>');
            }
            if (!options.length && !this.input.attribute('multiple')) {
                options.push('<option value="" selected="selected"></option>');
            }
            this.input.html(options.join(''));
        } else {
            this.input.value(this.getValue());
            this.input.attribute('value', this.input.value());
        }

        if (this.isSetup && !opts.silent) {
            this.emit('change', this.input.value());
        }
    },

    updatePlaceholder: function() {
        if (!this.options.placeholder) return;
        var control_input = this.$control_input;

        if (this.items.length) {
            control_input.attribute('placeholder', null);
        } else {
            control_input.attribute('placeholder', this.options.placeholder);
        }
        control_input.emit('update', { force: true });
    },

    open: function() {
        if (this.isLocked || this.isOpen || (this.options.mode === 'multi' && this.isFull())) return;
        this.focus();
        this.isOpen = true;
        this.refreshState();
        this.$dropdown.style({
            visibility: 'hidden',
            display: 'block'
        });
        this.positionDropdown();
        this.$dropdown.style({ visibility: 'visible' });
        this.emit('dropdown_open', this.$dropdown);
    },

    close: function() {
        var trigger = this.isOpen;

        if (this.options.mode === 'single' && this.items.length) {
            this.hideInput();
        }

        this.isOpen = false;
        this.$dropdown.hide();
        this.setActiveOption(null);
        this.refreshState();

        if (trigger) this.emit('dropdown_close', this.$dropdown);
    },

    positionDropdown: function() {
        var control = this.$control,
            offset  = control.position();//this.options.dropdownParent === 'body' ? control.offset() : control.position();
        offset.top += control[0].offsetHeight;

        this.$dropdown.style({
            width: control[0].offsetWidth,
            top: control[0].offsetTop + control[0].offsetHeight,
            left: control[0].offsetLeft
        });
    },

    clear: function(silent) {
        var non_input = this.$control.children(':not(input)');
        if (!this.items.length) return;

        if (non_input) non_input.remove();
        this.items = [];
        this.lastQuery = null;
        this.setCaret(0);
        this.setActiveItem(null);
        this.updatePlaceholder();
        this.updateOriginalInput({ silent: silent });
        this.refreshState();
        this.showInput();
        this.emit('clear');
    },

    insertAtCaret: function($el) {
        var caret = Math.min(this.caretPos, this.items.length);
        if (caret === 0) {
            $el.top(this.$control);//.prepend($el);
        } else {
            //$(this.$control[0].childNodes[caret]).before($el);
            $el.after(this.$control.find(':nth-child(' + caret + ')'));
            //this.$control.find(':nth-child(' + caret + ')').before($el);
        }
        this.setCaret(caret + 1);
    },

    deleteSelection: function(e) {
        var i, n, direction, selection, values, caret, option_select, $option_select, $tail;

        direction = (e && e.keyCode === KEY_BACKSPACE) ? -1 : 1;
        selection = getSelection(this.$control_input[0]);

        if (this.$activeOption && !this.options.hideSelected) {
            option_select = this.getAdjacentOption(this.$activeOption, -1);
            if (option_select) { option_select = option_select.attribute('data-value'); }
        }

        // determine items that will be removed
        values = [];

        if (this.$activeItems.length) {
            var children = this.$control.children(':not(input)');
            $tail = this.$control.children('.g-active');
            if ($tail) { $tail = $(direction > 0 ? last($tail) : $tail[0]); }
            caret = (!children ? -1 : indexOf(children, $tail[0]));
            if (direction > 0) { caret++; }

            for (i = 0, n = this.$activeItems.length; i < n; i++) {
                values.push($(this.$activeItems[i]).attribute('data-value'));
            }
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
        } else if ((this.isFocused || this.options.mode === 'single') && this.items.length) {
            if (direction < 0 && selection.start === 0 && selection.length === 0) {
                values.push(this.items[this.caretPos - 1]);
            } else if (direction > 0 && selection.start === this.$control_input.value().length) {
                values.push(this.items[this.caretPos]);
            }
        }

        // allow the callback to abort
        if (!values.length || (typeof this.options.onDelete === 'function' && this.options.onDelete.apply(this, [values]) === false)) {
            return false;
        }

        // perform removal
        if (typeof caret !== 'undefined') {
            this.setCaret(caret);
        }
        while (values.length) {
            this.removeItem(values.pop());
        }

        this.showInput();
        this.positionDropdown();
        this.refreshOptions(true);

        // select previous option
        if (option_select) {
            $option_select = this.getOption(option_select);
            if ($option_select.length) {
                this.setActiveOption($option_select);
            }
        }

        return true;
    },

    advanceSelection: function(direction, e) {
        var tail, selection, idx, valueLength, cursorAtEdge, $tail;

        if (direction === 0) return;
        if (this.rtl) direction *= -1;

        tail = direction > 0 ? 'last-child' : 'first-child';
        selection = getSelection(this.$control_input[0]);

        if (this.isFocused && !this.isInputHidden) {
            valueLength = this.$control_input.value().length;
            cursorAtEdge = direction < 0
                ? selection.start === 0 && selection.length === 0
                : selection.start === valueLength;

            if (cursorAtEdge && !valueLength) {
                this.advanceCaret(direction, e);
            }
        } else {
            $tail = this.$control.children('.g-active:' + tail);
            if ($tail) {
                idx = this.$control.children(':not(input)').index($tail);
                this.setActiveItem(null);
                this.setCaret(direction > 0 ? idx + 1 : idx);
            }
        }
    },

    advanceCaret: function(direction, e) {
        var fn, $adj;

        if (direction === 0) return;

        fn = direction > 0 ? 'nextSibling' : 'previousSibling';
        if (this.isShiftDown) {
            $adj = this.$control_input[fn]();
            if ($adj) {
                this.hideInput();
                this.setActiveItem($adj);
                e && e.preventDefault();
            }
        } else {
            this.setCaret(this.caretPos + direction);
        }
    },

    setCaret: function(i) {

        if (this.options.mode === 'single') {
            i = this.items.length;
        } else {
            i = Math.max(0, Math.min(this.items.length, i));
        }

        if (!this.isPending) {
            // the input must be moved by leaving it in place and moving the
            // siblings, due to the fact that focus cannot be restored once lost
            // on mobile webkit devices
            var j, n, fn, $children, $child;
            $children = this.$control.children(':not(input)');
            for (j = 0, n = ($children ? $children.length : 0); j < n; j++) {
                $child = $($children[j]);//.detach();
                if (j < i) {
                    $child.before(this.$control_input);
                } else {
                    this.$control.appendChild($child);
                }
            }
        }

        this.caretPos = i;
    },

    lock: function() {
        this.close();
        this.isLocked = true;
        this.refreshState();
    },

    unlock: function() {
        this.isLocked = false;
        this.refreshState();
    },

    disable: function() {
        this.input.disabled(true);
        this.$control_input.attribute('disabled', true).attribute('tabindex', -1);
        this.isDisabled = true;
        this.lock();
    },

    enable: function() {
        this.input.attribute('disabled', null);
        this.$control_input.attribute('disabled', null).attribute('tabindex', this.tabIndex);
        this.isDisabled = false;
        this.unlock();
    },

    destroy: function() {
        var revertSettings = this.revertSettings;

        this.emit('destroy');
        this.off();
        this.$wrapper.remove();
        this.$dropdown.remove();

        this.input
            .html('')
            .appendChild(revertSettings.$children)
            .attribute('tabindex', null)
            .removeClass('selectized')
            .attribute({ tabindex: revertSettings.tabindex })
            .show();

        /*$(window).off(eventNS);
         $(document).off(eventNS);
         $(document.body).off(eventNS);*/

        delete this.$control_input.selectizeGrow;
        delete this.input.selectizeInstance;
        delete this.input[0].selectize;
    },

    render: function(templateName, data) {
        var value, id, label;
        var name = '';
        var cache = false;
        var regex_tag = /^[\t \r\n]*<([a-z][a-z0-9\-_]*(?:\:[a-z][a-z0-9\-_]*)?)/i;

        if (templateName === 'option' || templateName === 'item') {
            value = hash_key(data[this.options.valueField]);
            cache = !!value;
        }

        // pull markup from cache if it exists
        if (cache) {
            if (!isset(this.renderCache[templateName])) {
                this.renderCache[templateName] = {};
            }
            if (this.renderCache[templateName].hasOwnProperty(value)) {
                return this.renderCache[templateName][value];
            }
        }

        // render markup
        var html = this.options.render[templateName].apply(this, [data, escapeHTML]);

        // add mandatory attributes
        if (templateName === 'option' || templateName === 'option_create') {
            html = html.replace(regex_tag, '<$1 data-selectable');
        }
        if (templateName === 'optgroup') {
            id = data[this.options.optgroupValueField] || '';
            name = escape_replace(escapeHTML(id));
            html = html.replace(regex_tag, '<$1 data-group="' + name + '" role="group" aria-label="' + name + '"');
        }
        if (templateName === 'option' || templateName === 'item') {
            name = escape_replace(escapeHTML(value || ''));
            html = html.replace(regex_tag, '<$1 data-value="' + name + '" id="' + slugify(this.rand + '-' + name) + '" role="treeitem" aria-label="' + trim(data.text) + '" aria-selected="false"');
        }

        // update cache
        if (cache) {
            this.renderCache[templateName][value] = html;
        }

        return html;
    },

    clearCache: function(templateName) {
        if (typeof templateName === 'undefined') {
            this.renderCache = {};
        } else {
            delete this.renderCache[templateName];
        }
    },

    canCreate: function(input) {
        if (!this.options.create) return false;
        var filter = this.options.createFilter;
        return input.length
            && (typeof filter !== 'function' || filter.apply(self, [input]))
            && (typeof filter !== 'string' || new RegExp(filter).test(input))
            && (!(filter instanceof RegExp) || filter.test(input));
    },

    getPreviousValue: function() {
        return this.previousValue;
    }
});

$.implement({
    selectize: function(settings_user) {
        settings_user = settings_user || {};
        var defaults             = Selectize.prototype.options,
            settings             = merge({}, defaults, settings_user),
            attr_data            = settings.dataAttr,
            field_label          = settings.labelField,
            field_value          = settings.valueField,
            field_optgroup       = settings.optgroupField,
            field_optgroup_label = settings.optgroupLabelField,
            field_optgroup_value = settings.optgroupValueField;

        var init_textbox = function(input, settings_element) {
            input = $(input);
            var i, n, values, option;

            var data_raw = input.attribute(attr_data);

            if (!data_raw) {
                var value = trim(input.value() || '');
                if (!settings.allowEmptyOption && !value.length) return;

                values = value.split(settings.delimiter);
                for (i = 0, n = values.length; i < n; i++) {
                    option = {};
                    option[field_label] = values[i];
                    option[field_value] = values[i];

                    settings_element.Options.push(option);
                }

                settings_element.items = values;
            } else {
                settings_element.Options = JSON.parse(data_raw);
                for (i = 0, n = settings_element.Options.length; i < n; i++) {
                    settings_element.items.push(settings_element.Options[i][field_value]);
                }
            }
        };

        var init_select = function(input, settings_element) {
            var i, n, tagName, children, order = 0;
            var options = settings_element.Options;
            var optionsMap = {};

            var readData = function(el) {
                var data = attr_data && el.attribute(attr_data);
                if (typeof data === 'string' && data.length) {
                    return JSON.parse(data);
                }
                return null;
            };

            var addOption = function(option, group) {
                var value, opt;

                option = $(option);

                value = hash_key(option.value());
                if (!value.length && !settings.allowEmptyOption) return;

                // if the option already exists, it's probably been
                // duplicated in another optgroup. in this case, push
                // the current group to the "optgroup" property on the
                // existing option so that it's rendered in both places.
                if (optionsMap.hasOwnProperty(value)) {
                    if (group) {
                        var arr = optionsMap[value][field_optgroup];
                        if (!arr) {
                            optionsMap[value][field_optgroup] = group;
                        } else if (!isArray(arr)) {
                            optionsMap[value][field_optgroup] = [arr, group];
                        } else {
                            arr.push(group);
                        }
                    }
                    return;
                }

                opt = readData(option) || {};
                opt[field_label] = opt[field_label] || option.text();
                opt[field_value] = opt[field_value] || value;
                opt[field_optgroup] = opt[field_optgroup] || group;

                optionsMap[value] = opt;
                options.push(opt);

                if (option.matches(':selected')) {
                    settings_element.items.push(value);
                }
            };

            var addGroup = function(optgroup) {
                var i, n, id, optgrp, options;

                optgroup = $(optgroup);
                id = optgroup.attribute('label');

                if (id) {
                    optgrp = readData(optgroup) || {};
                    optgrp[field_optgroup_label] = id;
                    optgrp[field_optgroup_value] = id;
                    settings_element.Optgroups.push(optgrp);
                }

                options = optgroup.search('option');
                for (i = 0, n = options.length; i < n; i++) {
                    addOption(options[i], id);
                }
            };

            settings_element.maxItems = input.attribute('multiple') ? null : 1;

            children = input.children() || 0;
            for (i = 0, n = children.length; i < n; i++) {
                tagName = children[i].tagName.toLowerCase();
                if (tagName === 'optgroup') {
                    addGroup(children[i]);
                } else if (tagName === 'option') {
                    addOption(children[i]);
                }
            }
        };

        return this.forEach(function($input, i) {
            $input = $($input);
            if ($input.selectizeInstance) return;

            var instance,
                dataOptions = $input.data('selectize'),
                tag_name    = $input.tag().toLowerCase(),
                placeholder = $input.attribute('placeholder') || $input.attribute('data-placeholder');

            // g5 custom
            if (dataOptions) { dataOptions = JSON.parse(dataOptions); }
            settings = merge({}, settings, dataOptions);
            // end g5 custom

            if (!placeholder && !settings.allowEmptyOption) {
                var chlds = $input.children('option[value=""]');
                placeholder = chlds ? $input.children('option[value=""]').text() : '';
            }

            var settings_element = {
                'placeholder': placeholder,
                'Options': [],
                'Optgroups': [],
                'items': []
            };

            if (tag_name === 'select') {
                init_select($input, settings_element);
            } else {
                init_textbox($input, settings_element);
            }

            instance = new Selectize($input, merge({}, defaults, settings_element, settings_user, dataOptions));
            $input.selectizeInstance = instance;
        });
    }
});

ready(function() {
    var selects = $('[data-selectize]');
    if (!selects) { return; }

    selects.selectize();
});


module.exports = Selectize;

},{"../utils/elements.utils":60,"elements/domready":101,"elements/zen":106,"moofx":107,"mout/array/indexOf":144,"mout/array/last":148,"mout/collection/forEach":156,"mout/function/bind":159,"mout/function/debounce":160,"mout/lang/isArray":171,"mout/lang/isBoolean":172,"mout/object/merge":203,"mout/object/size":208,"mout/object/unset":210,"mout/object/values":211,"mout/string/escapeHtml":224,"mout/string/slugify":236,"mout/string/trim":237,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266,"sifter":269}],54:[function(require,module,exports){
"use strict";

var prime   = require('prime'),
    Emitter = require('prime/emitter'),
    Bound   = require('prime-util/prime/bound'),
    Options = require('prime-util/prime/options'),
    zen     = require('elements/zen'),
    $       = require('../utils/elements.utils.js'),
    storage = require('prime/map')(),

    bind    = require('mout/function/bind'),
    merge   = require('mout/object/merge');

var Toaster = new prime({
    mixin: [Bound, Options],

    inherits: Emitter,

    options: {
        tapToDismiss: true,
        noticeClass: 'g-notifications',
        containerID: 'g-notifications-container',

        types: {
            base: '',
            error: 'fa-minus-circle',
            info: 'fa-info-circle',
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle'
        },

        showDuration: 300,
        showEquation: 'cubic-bezier(0.02, 0.01, 0.47, 1)',
        hideDuration: 500,
        hideEquation: 'cubic-bezier(0.02, 0.01, 0.47, 1)',

        timeOut: 2500, // timeOut and extendedTimeout to 0 == sticky
        extendedTimeout: 2500,

        location: 'bottom-right',

        titleClass: 'g-notifications-title',
        messageClass: 'g-notifications-message',
        closeButton: true,

        target: '#g5-container',
        targetLocation: 'bottom',

        newestOnTop: true,
        preventDuplicates: false,
        progressBar: true


        /*
        onShow: function() {},
        onHidden: function() {},
        onClick: function() {}
        */
    },

    constructor: function(options) {
        this.setOptions(options);

        this.id = 0;
        this.previousNotice = null;
        this.map = storage;
    },

    mergeOptions: function(options) {
        return merge(this.options, options || {});
    },

    base: function(message, title, options) {
        options = this.mergeOptions(options);

        return this.notify(merge(options, {
            title: title || '',
            type: options.type || 'base',
            message: message
        }));
    },

    success: function(message, title, options) {
        options = this.mergeOptions(options);

        return this.notify(merge(options, {
            title: title || 'Success!',
            type: 'success',
            message: message
        }));
    },

    info: function(message, title, options) {
        options = this.mergeOptions(options);

        return this.notify(merge(options, {
            title: title || 'Info',
            type: 'info',
            message: message
        }));
    },
    warning: function(message, title, options) {
        options = this.mergeOptions(options);

        return this.notify(merge(options, {
            title: title || 'Warning!',
            type: 'warning',
            message: message
        }));
    },

    error: function(message, title, options) {
        options = this.mergeOptions(options);

        return this.notify(merge(options, {
            title: title || 'Error!',
            type: 'error',
            message: message
        }));
    },

    notify: function(options) {
        options = this.mergeOptions(options);

        if (options.preventDuplicates && this.previousNotice === options.message) { return; }

        this.id++;
        this.previousNotice = options.message;

        var container = this.getContainer(options, true),
            element = zen('div'), title = zen('div'), message = zen('div'),
            icon = zen('i.fa'),
            progress = zen('div.g-notifications-progress'),
            close = zen('a.fa.fa-close[href="#"]');

        this.map.set(element, {
            container: container,
            interval: null,
            progressBar: {
                interval: null,
                hideETA: null,
                maxHideTime: null
            },
            response: {
                id: this.id,
                state: 'visible',
                start: new Date(),
                options: options
            },
            options: options
        });

        if (options.title) {
            element.appendChild(title.html(options.title).addClass(options.titleClass));
        }

        if (options.message) {
            element.appendChild(message.html(options.message).addClass(options.messageClass));
        }

        if (options.closeButton) {
            close.top(element);
        }

        if (options.progressBar) {
            progress.top(element);
        }

        if (options.type && options.title) {
            if (options.types[options.type]) {
                element.addClass('g-notifications-theme-' + options.type);
                icon.top(title).addClass(options.types[options.type]);
            }
        }

        element.style({ opacity: 0 });
        element[options.newestOnTop ? 'top' : 'bottom'](container);
        element.animate({ opacity: 1 }, {
            duration: options.showDuration,
            equation: options.showEquation,
            callback: options.onShow
        });

        if (options.timeOut > 0) {
            var map = this.map.get(element);
            map.interval = setTimeout(bind(function() {
                this.hide(element);
            }, this), options.timeOut);
            map.progressBar.maxHideTime = parseFloat(options.timeOut);
            map.progressBar.hideETA = new Date().getTime() + map.progressBar.maxHideTime;

            if (options.progressBar) {
                map.progressBar.interval = setInterval(bind(function() {
                    this.updateProgress(element, progress);
                }, this), 10);
            }

            this.map.set(element, map);
        }

        var stick = bind(function() { this.stickAround(element); }, this),
            delay = bind(function() { this.delayedHide(element); }, this);
        element.on('mouseover', stick);
        element.on('mouseout', delay);

        if (!options.onClick && options.tapToDismiss) {
            element.on('click', bind(function(){
                element.off('mouseover', stick);
                element.off('mouseout', delay);

                this.hide(element);
            }, this));
        }

        if (options.closeButton && close) {
            close.on('click', bind(function(event){
                event.stopPropagation();
                event.preventDefault();

                element.off('mouseover', stick);
                element.off('mouseout', delay);
                this.hide(element, true);
            }, this));
        }

    },

    stickAround: function(element) {
        var map = this.map.get(element);

        clearTimeout(map.interval);
        map.progressBar.hideETA = 0;
        element.animate({ opacity: 1 }, {
            duration: map.options.showDuration,
            equation: map.options.showEquation,
            callback: map.options.onShow
        });

        this.map.set(element, map);
    },

    hide: function(element, override) {
        if (element.find(':focus') && !override) { return; }

        var map = this.map.get(element);

        clearTimeout(map.progressBar.interval);

        this.map.set(element, map);
        return element.animate({ opacity: 0 }, {
            duration: map.options.hideDuration,
            equation: map.options.hideEquation,
            callback: bind(function() {
                this.remove(element);
                if (map.options.onHidden && map.response.state !== 'hidden') { map.options.onHidden(); }
                map.response.state = 'hidden';
                map.response.endTime = new Date();

                this.map.set(element, map);
            }, this)
        });
    },

    delayedHide: function(element, override) {
        var map = this.map.get(element);

        if (map.options.timeOut > 0 || map.options.extendedTimeout > 0) {
            map.interval = setTimeout(bind(function() {
                this.hide(element);
            }, this), map.options.extendedTimeout);
            map.progressBar.maxHideTime = parseFloat(map.options.extendedTimeout);
            map.progressBar.hideETA = new Date().getTime() + map.progressBar.maxHideTime;
        }

        this.map.set(element, map);
    },

    updateProgress: function(element, progress) {
        var map = this.map.get(element),
            percentage = ((map.progressBar.hideETA - (new Date().getTime())) / map.progressBar.maxHideTime) * 100;

        this.map.set(element, map);
        progress.style({ width: percentage + '%' });
    },

    getContainer: function(options, create) {
        options = this.mergeOptions(options);

        var container = $('#' + options.containerID);
        if (container) { return container; }

        if (create) { container = this.createContainer(options); }

        return container;
    },

    createContainer: function(options) {
        options = this.mergeOptions(options);

        return zen('div#' + options.containerID + '.' + options.location)[options.targetLocation](options.target).attribute('aria-live', 'polite').attribute('role', 'alert');
    },

    remove: function(element) {
        if (!element) { return; }

        var map = this.map.get(element);
        if (!map.container) { map.container = this.getContainer(map.options); }
        /*if ($toastElement.is(':visible')) {
            return;
        }*/

        element.remove();
        if (!map.container.children()) {
            map.container.remove();
            this.previousNotice = null;
        }

        this.map.set(element, map);
    }
});

var toaster = new Toaster();

module.exports = toaster;

},{"../utils/elements.utils.js":60,"elements/zen":106,"mout/function/bind":159,"mout/object/merge":203,"prime":267,"prime-util/prime/bound":263,"prime-util/prime/options":264,"prime/emitter":266,"prime/map":268}],55:[function(require,module,exports){
"use strict";
var ready         = require('elements/domready'),
    $             = require('elements'),

    modal         = require('./modal'),
    toastr        = require('./toastr'),
    request       = require('agent'),

    getAjaxSuffix = require('../utils/get-ajax-suffix'),
    parseAjaxURI  = require('../utils/get-ajax-url').parse,
    getAjaxURL    = require('../utils/get-ajax-url').global;

var hiddens,
    toggles = function(event, element) {
        if (event.type.match(/^touch/) || event.type == 'click') { event.preventDefault(); }
        if (event.type == 'click') { return false; }
        element = $(element);
        hiddens = element.find('~~ [type=hidden]');

        if (!hiddens) return true;
        hiddens.value(hiddens.value() == '0' ? '1' : '0');
        element.parent('.enabler').attribute('aria-checked', hiddens.value() == '1' ? 'true' : 'false');

        hiddens.emit('change');
        $('body').emit('change', { target: hiddens });

        return false;
    };

ready(function() {
    var body = $('body');
    body.delegate('keydown', '.enabler', function(event, element){
        element = $(element);
        if (element.disabled() || element.find('[disabled]')) {
            return;
        }

        var key = (event.which ? event.which : event.keyCode);
        if (key == 32 || key == 13) { // ARIA support: Space / Enter toggle
            event.preventDefault();
            toggles(event, element.find('.toggle'));
        }
    });

    ['touchend', 'mouseup', 'click'].forEach(function(event) {
        body.delegate(event, '.enabler .toggle', toggles);
    });

    var URI = parseAjaxURI(getAjaxURL('devprod') + getAjaxSuffix());
    body.delegate('change', '[data-g-devprod] input[type="hidden"]', function(event, element) {
        var value = element.value(),
            parent = element.parent('[data-g-devprod]'),
            labels = JSON.parse(parent.data('g-devprod'));

        parent.showIndicator();

        request('post', URI, { mode: value }, function(error, response) {
            if (!response.body.success) {
                modal.open({
                    content: response.body.html || response.body,
                    afterOpen: function(container) {
                        if (!response.body.html) { container.style({ width: '90%' }); }
                    }
                });

                element.value(!value);
            } else {
                parent.find('.devprod-mode').text(labels[response.body.mode] || 'Unknown');
                toastr.success(response.body.html, response.body.title);
            }

            parent.hideIndicator();
        });
    });
});

module.exports = {};

},{"../utils/get-ajax-suffix":64,"../utils/get-ajax-url":65,"./modal":50,"./toastr":54,"agent":71,"elements":103,"elements/domready":101}],56:[function(require,module,exports){
"use strict";

var ready    = require('elements/domready'),
    tooltips = require('ext/tooltips');

tooltips.defaults = {
    baseClass: 'g-tips',
    typeClass: null,
    effectClass: 'g-fade',
    inClass: 'g-tip-in',
    place: 'top',
    spacing: 10,
    offset: -3,
    auto: 1
};

var Instance = null;

ready(function() {
    Instance = new tooltips(document, {
        tooltip: tooltips.defaults,
        key: 'tip',
        showOn: 'mouseenter',
        hideOn: 'mouseleave',
        observe: 1
    });

    window.G5.tips = Instance;
});

module.exports = Instance;

},{"elements/domready":101,"ext/tooltips":"ext/tooltips"}],57:[function(require,module,exports){
"use strict";

var prime         = require('prime'),
    $             = require('../utils/elements.utils'),
    zen           = require('elements/zen'),
    domready      = require('elements/domready'),
    storage       = require('prime/map')(),
    modal         = require('../ui').modal,

    size          = require('mout/collection/size'),
    indexOf       = require('mout/array/indexOf'),
    merge         = require('mout/object/merge'),
    keys          = require('mout/object/keys'),
    guid          = require('mout/random/guid'),
    toQueryString = require('mout/queryString/encode'),
    contains      = require('mout/string/contains'),

    getParam      = require('mout/queryString/getParam'),
    setParam      = require('mout/queryString/setParam'),

    request       = require('agent')(),
    History       = require('./history'),
    flags         = require('./flags-state'),
    parseAjaxURI  = require('./get-ajax-url').parse,
    getAjaxSuffix = require('./get-ajax-suffix'),
    lm            = require('../lm'),
    mm            = require('../menu'),
    assignments   = require('../assignments');

require('../ui/popover');

var ERROR = false, TMP_SELECTIZE_DISABLE = false, ConfNavIndex = -1;

History.Adapter.bind(window, 'statechange', function() {
    if (request.running()) {
        return false;
    }
    var body = $('body'),
        State = History.getState(),
        URI = State.url,
        Data = State.data,
        sidebar = $('#navbar'),
        mainheader = $('#main-header'),
        params = '';

    if (Data.doNothing) { return true; }

    if (size(Data) && Data.parsed !== false && storage.get(Data.uuid)) {
        Data = storage.get(Data.uuid);
    }

    if (Data.element) {
        var isTopNavOrMenu = Data.element.parent('#main-header') || Data.element.matches('.menu-select-wrap');
        body.emit('statechangeBefore', {
            target: Data.element,
            Data: Data
        });
    } else {
        var url = URI.replace(window.location.origin, '');
        Data.element = $('[href="' + url + '"]');
    }

    URI = parseAjaxURI(URI + getAjaxSuffix());

    var lis;
    if (sidebar && Data.element) {
        var active = sidebar.search('li.active');
        lis = sidebar.search('li');
        lis.removeClass('active');

        if (Data.element.parent('#navbar')) {
            Data.element.parent('li').addClass('active');
        }
    }

    if (mainheader && Data.element && (!Data.element.matches('a.menu-item') && !Data.element.matches('select.menu-select-wrap'))) {
        lis = mainheader.search('.float-right li');
        lis.removeClass('active');

        if (Data.element.parent('#main-header')) {
            Data.element.parent('li').addClass('active');
        }
    }

    if (Data.params) {
        params = toQueryString(JSON.parse(Data.params));
        if (contains(URI, '?')) { params = params.replace(/^\?/, '&'); }
    }

    if (!ERROR) { modal.closeAll(); }
    request.url(URI + params).data(Data.extras || {}).method(Data.extras ? 'post' : 'get').send(function(error, response) {
        if (!response.body.success) {
            if (!ERROR) {
                ERROR = true;
                modal.open({
                    content: response.body.html || response.body,
                    afterOpen: function(container) {
                        if (!response.body.html) { container.style({ width: '90%' }); }
                    }
                });

                History.back();
            } else {
                ERROR = false;
            }

            if (Data.element) {
                Data.element.hideIndicator();
            }

            return false;

        }

        var target = Data.parent ? Data.element.parent(Data.parent) : $(Data.target),
            destination = (target || $('[data-g5-content]') || body);

        if (response.body && response.body.html) {
            var fader;
            destination.html(response.body.html);
            if (fader = (destination.matches('[data-g5-content]') ? destination : destination.find('[data-g5-content]'))) {
                fader.style({ opacity: 0 });
                if (isTopNavOrMenu) { $(navbar).attribute('tabindex', '-1').attribute('aria-hidden', 'true'); }
                $('#navbar')[isTopNavOrMenu ? 'slideUp' : 'slideDown']();
                fader.animate({ opacity: 1 });
            }
        } else { destination.html(response.body); }

        body.getPopover().hideAll(true).destroy();

        if (Data.element) {
            body.emit('statechangeAfter', {
                target: Data.element,
                Data: Data
            });
        }

        var element = (Data.event && Data.event.activeSpinner) || Data.element;
        if (element) {
            element.hideIndicator();
        }

        var selects = $('[data-selectize]');
        if (selects) { selects.selectize(); }
        selectorChangeEvent();
        assignments.chromeFix();

        body.emit('statechangeEnd');
    });
});

var selectorChangeEvent = function() {
    var selectors = $('[data-selectize-ajaxify]');
    if (!selectors) { return; }

    selectors.forEach(function(selector) {
        selector = $(selector);
        var selectize = selector.selectize().selectizeInstance;
        if (!selectize || selectize.HasChangeEvent) { return; }

        selectize.on('change', function() {
            if (TMP_SELECTIZE_DISABLE) {
                TMP_SELECTIZE_DISABLE = false;
                return false;
            }
            var value = selectize.getValue(),
                options = selectize.Options,
                flagCallback = function() {
                    flags.off('update:pending', flagCallback);
                    modal.close();

                    selectize.input
                        .data('g5-ajaxify', '')
                        .data('g5-ajaxify-target', selector.data('g5-ajaxify-target') || '[data-g5-content-wrapper]')
                        .data('g5-ajaxify-target-parent', selector.data('g5-ajaxify-target-parent') || null)
                        .data('g5-ajaxify-href', options[value].url)
                        .data('g5-ajaxify-params', options[value].params ? JSON.stringify(options[value].params) : null);


                    var active = $('#navbar li.active') || $('#main-header li.active') || $('#navbar li:nth-child(2)');
                    if (active) { active.showIndicator(); }

                    $('body').emit('click', {
                        target: selectize.input,
                        activeSpinner: active
                    });
                };

            if (!options[value]) { return; }

            if (flags.get('pending')) {
                flags.warning({
                    callback: function(response, content) {
                        var saveContinue = content.find('[data-g-unsaved-save]'),
                            discardContinue = content.find('[data-g-unsaved-discard]');

                        if (!saveContinue) { return; }
                        saveContinue.on('click', function(e) {
                            e.preventDefault();
                            if (this.attribute('disabled')) { return false; }

                            $([saveContinue, discardContinue]).attribute('disabled');
                            flags.on('update:pending', flagCallback);
                            $('body').emit('click', { target: $('.button-save') });
                        });

                        discardContinue.on('click', function(e) {
                            e.preventDefault();
                            if (this.attribute('disabled')) { return false; }

                            $([saveContinue, discardContinue]).attribute('disabled');
                            flags.set('pending', false);
                            flagCallback();
                        });
                    },

                    afterclose: function() {
                        TMP_SELECTIZE_DISABLE = true;
                        selectize.setValue(selectize.getPreviousValue());
                    }
                });

                return;
            }

            flagCallback();
        });

        selectize.HasChangeEvent = true;
    });
};


domready(function() {
    var body = $('body');

    // Update NONCE if any
    if (GANTRY_AJAX_NONCE) {
        var currentURI = History.getPageUrl(),
            currentNonce = getParam(currentURI, '_wpnonce'),
            currentView = getParam(currentURI, 'view');

        // hack to inject the default view in WP in case it's missing
        if (!currentView) {
            currentURI = setParam(currentURI, 'view', 'configurations/default/styles');
            History.replaceState({ uuid: guid(), doNothing: true }, window.document.title, currentURI);
        }

        // refresh nonce
        if (currentNonce !== GANTRY_AJAX_NONCE) {
            currentURI = setParam(currentURI, '_wpnonce', GANTRY_AJAX_NONCE);
            History.replaceState({ uuid: guid(), doNothing: true }, window.document.title, currentURI);
        }
    }

    // back to configuration
    body.delegate('click', '.button-back-to-conf', function(event, element) {
        event.preventDefault();

        var confSelector = $('#configuration-selector'),
            outlineDeleted = body.outlineDeleted,
            currentOutline = confSelector.value();

        ConfNavIndex = ConfNavIndex == -1 ? 1 : ConfNavIndex;
        var navbar = $('#navbar'),
            item = navbar.find('li:nth-child(' + (ConfNavIndex + 1) + ') [data-g5-ajaxify]');

        if (flags.get('pending')) {
            flags.warning({
                callback: function(response, content) {
                    var saveContinue = content.find('[data-g-unsaved-save]'),
                        discardContinue = content.find('[data-g-unsaved-discard]'),
                        flagCallback = function() {
                            flags.off('update:pending', flagCallback);
                            modal.close();

                            body.emit('click', { target: item });
                            navbar.attribute('tabindex', null).attribute('aria-hidden', 'false');
                            navbar.slideDown();
                        };

                    if (!saveContinue) { return; }
                    saveContinue.on('click', function(e) {
                        e.preventDefault();
                        if (this.attribute('disabled')) { return false; }

                        $([saveContinue, discardContinue]).attribute('disabled');
                        flags.on('update:pending', flagCallback);
                        body.emit('click', { target: $('.button-save') });
                    });

                    discardContinue.on('click', function(e) {
                        e.preventDefault();
                        if (this.attribute('disabled')) { return false; }

                        $([saveContinue, discardContinue]).attribute('disabled');
                        flags.set('pending', false);
                        flagCallback();
                    });
                }
            });

            return;
        }

        element.showIndicator();

        if (outlineDeleted == currentOutline) {
            var ids = keys(confSelector.selectizeInstance.Options),
                id = ids.shift();
            body.outlineDeleted = null;
            item.href(item.href().replace('/' + outlineDeleted + '/', '/' + id + '/').replace('style=' + outlineDeleted, 'style=' + id));
        }

        body.emit('click', { target: item });
        navbar.attribute('tabindex', null);
        navbar.slideDown();
    });

    body.delegate('click', '#navbar a[data-g5-ajaxify]', function(event, element) {
        var navbar = $('#navbar'),
            lis = navbar.search('li a[data-g5-ajaxify]');

        ConfNavIndex = indexOf(lis, element[0]) + 1;
    });

    // generic ajaxified links
    body.delegate('click', '[data-g5-ajaxify]', function(event, element) {
        if (event && event.preventDefault) {
            if (event.which === 2 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
                return true;
            }

            event.preventDefault();
        }

        if (flags.get('pending') && (!element.matches('a.menu-item') && !element.parent('[data-menu-items]'))) {
            flags.warning({
                callback: function(response, content) {
                    var saveContinue = content.find('[data-g-unsaved-save]'),
                        discardContinue = content.find('[data-g-unsaved-discard]'),
                        flagCallback = function() {
                            flags.off('update:pending', flagCallback);
                            modal.close();
                            body.emit('click', event);
                        };

                    if (!saveContinue) { return; }
                    saveContinue.on('click', function(e) {
                        e.preventDefault();
                        if (this.attribute('disabled')) { return false; }

                        $([saveContinue, discardContinue]).attribute('disabled');
                        flags.on('update:pending', flagCallback);
                        body.emit('click', { target: $('.button-save') });
                    });

                    discardContinue.on('click', function(e) {
                        e.preventDefault();
                        if (this.attribute('disabled')) { return false; }

                        $([saveContinue, discardContinue]).attribute('disabled');
                        flags.set('pending', false);
                        flagCallback();
                    });
                }
            });

            return;
        }

        element.showIndicator();

        var data = element.data('g5-ajaxify'),
            target = element.data('g5-ajaxify-target'),
            parent = element.data('g5-ajaxify-target-parent'),
            url = element.attribute('href') || element.data('g5-ajaxify-href'),
            params = element.data('g5-ajaxify-params') || false,
            title = element.attribute('title') || window.document.title;

        data = data ? JSON.parse(data) : { parsed: false };
        if (data) {
            var uuid = guid(), extras;

            // TODO: The menu needs to be able to receive POST
            if (element.data('mm-id') || element.parent('[data-mm-id]')) {
                extras = {};
                extras.menutype = $('select.menu-select-wrap').value();
                extras.settings = JSON.stringify(mm.menumanager.settings);
                extras.ordering = JSON.stringify(mm.menumanager.ordering);
                extras.items = JSON.stringify(mm.menumanager.items);
            }

            storage.set(uuid, merge({}, data, {
                target: target,
                parent: parent,
                element: element,
                params: params,
                extras: extras,
                event: event
            }));
            data = { uuid: uuid };
        }

        History.pushState(data, title, url);

        var navbar, active, actives = $('#navbar .active, #main-header .active');

        if (navbar = element.parent('#navbar, #main-header')) {
            if (actives) { actives.removeClass('active'); }

            active = navbar.search('.active');
            if (active) { active.removeClass('active'); }
            element.parent('li').addClass('active');
        }
    });

    // attach change events to configurations selector
    selectorChangeEvent();
});


module.exports = {};

},{"../assignments":2,"../lm":25,"../menu":31,"../ui":49,"../ui/popover":51,"../utils/elements.utils":60,"./flags-state":63,"./get-ajax-suffix":64,"./get-ajax-url":65,"./history":68,"agent":71,"elements/domready":101,"elements/zen":106,"mout/array/indexOf":144,"mout/collection/size":158,"mout/object/keys":202,"mout/object/merge":203,"mout/queryString/encode":212,"mout/queryString/getParam":213,"mout/queryString/setParam":215,"mout/random/guid":217,"mout/string/contains":223,"prime":267,"prime/map":268}],58:[function(require,module,exports){
"use strict";

// credits: https://github.com/cowboy/javascript-sync-async-foreach
var asyncForEach = function(arr, eachFn, doneFn) {
    arr = arr || [];
    var i = -1;
    // Resolve array length to a valid (ToUint32) number.
    var len = arr.length >>> 0;

    (function next(result) {
        // This flag will be set to true if `this.async` is called inside the
        // eachFn` callback.
        var async;
        // Was false returned from the `eachFn` callback or passed to the
        // `this.async` done function?
        var abort = result === false;

        // Increment counter variable and skip any indices that don't exist. This
        // allows sparse arrays to be iterated.
        do { ++i; } while (!(i in arr) && i !== len);

        // Exit if result passed to `this.async` done function or returned from
        // the `eachFn` callback was false, or when done iterating.
        if (abort || i === len) {
            // If a `doneFn` callback was specified, invoke that now. Pass in a
            // boolean value representing "not aborted" state along with the array.
            if (doneFn) {
                doneFn(!abort, arr);
            }
            return;
        }

        // Invoke the `eachFn` callback, setting `this` inside the callback to a
        // custom object that contains one method, and passing in the array item,
        // index, and the array.
        result = eachFn.call({
            // If `this.async` is called inside the `eachFn` callback, set the async
            // flag and return a function that can be used to continue iterating.
            async: function() {
                async = true;
                return next;
            }
        }, arr[i], i, arr);

        // If the async flag wasn't set, continue by calling `next` synchronously,
        // passing in the result of the `eachFn` callback.
        if (!async) {
            next(result);
        }
    }());
};

module.exports = asyncForEach;

},{}],59:[function(require,module,exports){
'use strict';

var rAF = (function() {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        function(callback) { window.setTimeout(callback, 1000 / 60); };
}());

var decouple = function(element, event, callback) {
    var evt, tracking = false;
    element = element[0] || element;

    var capture = function(e) {
        evt = e;
        track();
    };

    var track = function() {
        if (!tracking) {
            rAF(update);
            tracking = true;
        }
    };

    var update = function() {
        callback.call(element, evt);
        tracking = false;
    };

    element.addEventListener(event, capture, false);
};

module.exports = decouple;
},{}],60:[function(require,module,exports){
"use strict";
var $          = require('elements'),
    moofx      = require('moofx'),
    map        = require('mout/array/map'),
    series     = require('mout/function/series'),
    slick      = require('slick'),
    zen        = require('elements/zen'),
    progresser = require('../ui/progresser');

var walk = function(combinator, method) {

    return function(expression) {
        var parts = slick.parse(expression || "*");

        expression = map(parts, function(part) {
            return combinator + " " + part;
        }).join(', ');

        return this[method](expression);
    };

};


$.implement({
    style: function() {
        var moo = moofx(this);
        moo.style.apply(moo, arguments);
        return this;
    },

    animate: function() {
        var moo = moofx(this);
        moo.animate.apply(moo, arguments);
        return this;
    },

    hide: function() {
        return this.style('display', 'none');
    },

    show: function(mode) {
        return this.style('display', mode || 'inherit');
    },

    progresser: function(options) {
        var instance;

        this.forEach(function(node) {
            instance = node.ProgresserInstance;

            if (!instance) { instance = new progresser(node, options); }
            else { instance.constructor(node, options); }

            node.ProgresserInstance = instance;
            return instance;
        });
    },

    compute: function() {
        var moo = moofx(this);
        return moo.compute.apply(moo, arguments);
    },

    showIndicator: function(klass, keepIcon) {
        this.forEach(function(node) {
            node = $(node);
            if (typeof klass == 'boolean') {
                keepIcon = klass;
                klass = null;
            }

            var icon = keepIcon ? false : node.find('i');
            node.gHadIcon = !!icon;

            if (!icon) {
                if (!node.find('span') && !node.children()) { zen('span').text(node.text()).top(node.empty()); }

                icon = zen('i');
                icon.top(node);
            }

            if (!node.gIndicator) { node.gIndicator = icon.attribute('class') || true; }
            icon.attribute('class', klass || 'fa fa-fw fa-spin-fast fa-spinner');
        });
    },

    hideIndicator: function() {
        this.forEach(function(node) {
            node = $(node);
            if (!node.gIndicator) { return; }

            var icon = node.find('i');

            if (!icon) { return; }

            if (!node.gHadIcon) { icon.remove(); }
            else { icon.attribute('class', node.gIndicator); }

            node.gIndicator = null;
        });
    },

    slideDown: function(animation, callback) {
        var element       = this,
            size          = this.getRealSize(),
            callbackStart = function() {
                element.gSlideCollapsed = false;
            },
            callbackEnd   = function() {
                element.attribute('style', element.gSlideStyle);
            };

        callback = typeof animation == 'function' ? animation : (callback || function() {});
        if (this.gSlideCollapsed === false) { return callback(); }
        callback = series(callbackStart, callback, callbackEnd);

        animation = typeof animation == 'string' ? animation : {
            duration: '250ms',
            callback: callback
        };

        this.style('visibility', 'visible').attribute('aria-hidden', false);
        this.animate({ height: size.height }, animation);
    },

    slideUp: function(animation, callback) {
        if (typeof this.gSlideCollapsed == 'undefined') {
            this.gSlideStyle = this.attribute('style');
        }

        var element       = this,
            callbackStart = function() {
                element.gSlideCollapsed = true;
            },
            callbackEnd = function() {
                element.style('visibility', 'hidden').attribute('aria-hidden', true);
            };

        callback = typeof animation == 'function' ? animation : (callback || function() {});
        if (this.gSlideCollapsed === true) { return callback(); }
        callback = series(callbackStart, callback, callbackEnd);

        animation = typeof animation == 'string' ? animation : {
            duration: '250ms',
            callback: callback
        };
        this.style({ overflow: 'hidden' }).animate({ height: 0 }, animation);
    },

    slideToggle: function(animation, callback) {
        var size = this.getRealSize();
        return this[size.height && !this.gSlideCollapsed ? 'slideUp' : 'slideDown'](animation, callback);
    },

    getRealSize: function() {
        var style = this.attribute('style'), size;
        this.style({
            position: 'relative',
            overflow: 'inherit',
            top: -50000,
            height: 'auto',
            width: 'auto'
        });

        size = {
            width: parseInt(this.compute('width'), 10),
            height: parseInt(this.compute('height'), 10)
        };

        this.attribute('style', style);

        return size;
    },

    sibling: walk('++', 'find'),

    siblings: walk('~~', 'search')
});

module.exports = $;

},{"../ui/progresser":52,"elements":103,"elements/zen":106,"moofx":107,"mout/array/map":149,"mout/function/series":164,"slick":271}],61:[function(require,module,exports){
"use strict";
var $     = require('elements');

$.implement({
    belowthefold: function(expression, treshold) {
        var elements = this.search(expression);
        treshold = treshold || 0;
        if (!elements) { return false; }

        var fold = this.position().height + this[0].scrollTop;
        return elements.filter(function(element) {
            return fold <= $(element)[0].offsetTop - treshold;
        });
    },

    abovethetop: function(expression, treshold) {
        var elements = this.search(expression);
        treshold = treshold || 0;
        if (!elements) { return false; }

        var top = this[0].scrollTop;
        return elements.filter(function(element) {
            return top >= $(element)[0].offsetTop + $(element).position().height - treshold;
        });
    },

    rightofscreen: function(expression, treshold) {
        var elements = this.search(expression);
        treshold = treshold || 0;
        if (!elements) { return false; }

        var fold = this.position().width + this[0].scrollLeft;
        return elements.filter(function(element) {
            return fold <= $(element)[0].offsetLeft - treshold;
        });
    },

    leftofscreen: function(expression, treshold) {
        var elements = this.search(expression);
        treshold = treshold || 0;
        if (!elements) { return false; }

        var left = this[0].scrollLeft;
        return elements.filter(function(element) {
            return left >= $(element)[0].offsetLeft + $(element).position().width - treshold;
        });
    },

    inviewport: function(expression, treshold) {
        var elements = this.search(expression);
        treshold = treshold || 0;
        if (!elements) { return false; }

        var position = this.position();
        return elements.filter(function(element) {
            element = $(element);
            return element[0].offsetTop + treshold >= this[0].scrollTop &&
                element[0].offsetTop - treshold <= this[0].scrollTop + position.height;
        }, this);
    }
});

module.exports = $;

},{"elements":103}],62:[function(require,module,exports){
"use strict";

var $ = require('elements');

var fieldValidation = function(field) {
    field = $(field);
    var _field = field[0],
        tag = field.tag(),
        type = field.type(),
        isValid = true;

    // only validate input, textarea, select
    if (!~['input', 'textarea', 'select'].indexOf(tag)) { return isValid; }

    // use native validation if available
    if (typeof _field.willValidate !== 'undefined') {
        if (tag == 'input' && (_field.type.toLowerCase() !== type || field.hasClass('custom-validation-field'))) {
            // type not supported or custom, fallback validation
            _field.setCustomValidity(validate(field) ? '' : 'The field value is invalid');
        }

        // native validity check
        _field.checkValidity();

    } else {
        _field.validity = _field.validity || {};
        _field.validity.valid = validate(field);
    }

    isValid = _field.validity.valid;

    return isValid;
};

var validate = function(field) {
    field = $(field);

    var isValid = true,
        value = field.value(),
        type = field.type(),
        isCheckbox = (type == 'checkbox' || type == 'radio'),
        disabled = field.attribute('disabled'),
        required = field.attribute('required'),
        minlength = field.attribute('minlength'),
        maxlength = field.attribute('maxlength'),
        min = field.attribute('min'),
        max = field.attribute('max'),
        pattern = field.attribute('pattern');

    // disabled fields should not be validated
    if (disabled) { return isValid; }

    // required
    isValid = isValid && (!required || (isCheckbox && field.checked()) || (!isCheckbox && value));

    // minlength / maxlength
    isValid = isValid && (isCheckbox || ((!minlength || value.length >= minlength) && (!maxlength || value.length <= maxlength)));

    // pattern
    if (isValid && pattern) {
        pattern = new RegExp(pattern);
        isValid = pattern.test(value);
    }

    // min / max
    if (isValid && (min !== null || max !== null)) {
        if (min !== null) {
            isValid = parseFloat(value) >= parseFloat(min);
        }

        if (max !== null) {
            isValid = parseFloat(value) <= parseFloat(max);
        }
    }

    return isValid;
};

module.exports = fieldValidation;

},{"elements":103}],63:[function(require,module,exports){
"use strict";

var prime         = require('prime'),
    map           = require('prime/map'),
    Emitter       = require('prime/emitter'),
    modal         = require('../ui').modal,

    getAjaxURL    = require('./get-ajax-url').global,
    parseAjaxURI  = require('./get-ajax-url').parse,
    getAjaxSuffix = require('./get-ajax-suffix');

var FlagsState = new prime({

    inherits: Emitter,

    constructor: function() {
        this.flags = map();
    },

    set: function(key, value) {
        return this.flags.set(key, value).get(key);
    },

    get: function(key, def) {
        var value = this.flags.get(key);
        return value ? value : this.set(key, def);
    },

    keys: function() {
        return this.flags.keys();
    },

    values: function() {
        return this.flags.values();
    },

    warning: function(options){
        var callback = options.callback || function() {},
            afterclose = options.afterclose || function() {},
            warningURL = parseAjaxURI(options.url || getAjaxURL('unsaved') + getAjaxSuffix());

        if (!options.url && !options.message) { options.url = true; }
        if (options.url) {
            modal.open({
                content: 'Loading...',
                remote: warningURL,
                data: options.data || false,
                remoteLoaded: function(response, modal) {
                    var content = modal.elements.content;
                    if (!callback) { return; }

                    callback.call(this, response, content, modal);
                },
                afterClose: afterclose || function() {}
            });
        } else {
            modal.open({
                content: options.message,
                afterOpen: function(response, modal) {
                    var content = modal.elements.content;
                    if (!callback) { return; }

                    callback.call(this, response, content, modal);
                },
                afterClose: afterclose || function() {}
            });
        }
    }

});

module.exports = new FlagsState();

},{"../ui":49,"./get-ajax-suffix":64,"./get-ajax-url":65,"prime":267,"prime/emitter":266,"prime/map":268}],64:[function(require,module,exports){
"use strict";

var GANTRY_AJAX_SUFFIX = window.GANTRY_AJAX_SUFFIX || undefined;
var getAjaxSuffix = function() {
    return typeof GANTRY_AJAX_SUFFIX == 'undefined' ? '' : GANTRY_AJAX_SUFFIX;
};

module.exports = getAjaxSuffix;
},{}],65:[function(require,module,exports){
"use strict";
var unescapeHtml  = require('mout/string/unescapeHtml'),
    getAjaxSuffix = require('./get-ajax-suffix'),
    getQuery      = require('mout/queryString/getQuery'),
    getParam      = require('mout/queryString/getParam'),
    setParam      = require('mout/queryString/setParam');

var GANTRY_AJAX_URL      = window.GANTRY_AJAX_URL || '',
    GANTRY_AJAX_CONF_URL = window.GANTRY_AJAX_CONF_URL || '',
    GANTRY_PLATFORM      = window.GANTRY_PLATFORM || '';

var getAjaxURL = function(view, search) {
    if (!search) { search = '%ajax%'; }
    var re  = new RegExp(search, 'g'),
        url = typeof GANTRY_AJAX_URL == 'undefined' ? '' : GANTRY_AJAX_URL;

    return unescapeHtml(url.replace(re, view));
};

var getConfAjaxURL = function(view, search) {
    if (!search) { search = '%ajax%'; }
    var re  = new RegExp(search, 'g'),
        url = typeof GANTRY_AJAX_CONF_URL == 'undefined' ? '' : GANTRY_AJAX_CONF_URL;

    return unescapeHtml(url.replace(re, view));
};

var parseAjaxURI = function(uri) {
    var platform = typeof GANTRY_PLATFORM == 'undefined' ? '' : GANTRY_PLATFORM;
    switch (platform) {
        case 'wordpress':
            uri = uri.replace(/themes\.php/ig, 'admin-ajax.php');
            break;
        case 'grav':
            // converts foo/bar?nonce=1234.json to foo/bar.json?nonce=1234
            var query  = '' + getQuery(uri),
                nonce  = '' + getParam(uri, 'nonce'),
                suffix = getAjaxSuffix();

            uri = uri.replace(query, suffix) + query.replace(nonce, (nonce.replace(suffix, '')));
            break;
        default:
    }

    return uri;
};

module.exports = {
    global: getAjaxURL,
    config: getConfAjaxURL,
    parse: parseAjaxURI
};
},{"./get-ajax-suffix":64,"mout/queryString/getParam":213,"mout/queryString/getQuery":214,"mout/queryString/setParam":215,"mout/string/unescapeHtml":239}],66:[function(require,module,exports){
"use strict";

var zen = require('elements/zen');

var cached            = null,
    getScrollbarWidth = function() {
        if (cached !== null) { return cached; }

        var size, dummy = zen('div').bottom('#g5-container');
        dummy.style({
            width: 100,
            height: 100,
            overflow: 'scroll',
            position: 'absolute',
            zIndex: -9999
        });

        size = dummy[0].offsetWidth - dummy[0].clientWidth;
        dummy.remove();

        cached = size;
        return size;
    };

module.exports = getScrollbarWidth;

},{"elements/zen":106}],67:[function(require,module,exports){
"use strict";

var $        = require('elements'),
    domready = require('elements/domready');

// Localise Globals
var History = {};

// Check Existence
if (typeof History.Adapter !== 'undefined') {
    throw new Error('History.js Adapter has already been loaded...');
}

// Add the Adapter
History.Adapter = {
    /**
     * History.Adapter.bind(el,event,callback)
     * @param {Element|string} el
     * @param {string} event - custom and standard events
     * @param {function} callback
     * @return {void}
     */
    bind: function(el, event, callback) {
        $(el).on(event, callback);
    },

    /**
     * History.Adapter.trigger(el,event)
     * @param {Element|string} el
     * @param {string} event - custom and standard events
     * @param {Object=} extra - a object of extra event data (optional)
     * @return void
     */
    trigger: function(el, event, extra) {
        $(el).emit(event, extra);
    },

    /**
     * History.Adapter.extractEventData(key,event,extra)
     * @param {string} key - key for the event data to extract
     * @param {string} event - custom and standard events
     */
    extractEventData: function(key, event) {
        // MooTools Native then MooTools Custom
        return (event && event.event && event.event[key]) || (event && event[key]) || undefined;
    },

    /**
     * History.Adapter.onDomLoad(callback)
     * @param {function} callback
     * @return {void}
     */
    onDomLoad: function(callback) {
        domready(callback);
    }
};

// Try and Initialise History
if (typeof History.init !== 'undefined') {
    History.init();
}

module.exports = History;
},{"elements":103,"elements/domready":101}],68:[function(require,module,exports){
"use strict";

// ========================================================================
// Initialise

// Localise Globals
var
    console        = window.console || undefined, // Prevent a JSLint complain
    document       = window.document, // Make sure we are using the correct document
    navigator      = window.navigator, // Make sure we are using the correct navigator
    sessionStorage = false, // sessionStorage
    setTimeout     = window.setTimeout,
    clearTimeout   = window.clearTimeout,
    setInterval    = window.setInterval,
    clearInterval  = window.clearInterval,
    JSON           = window.JSON,
    alert          = window.alert,
    History        = window.History = require('./history-adapter') || {}, // Public History Object
    history        = window.history; // Old History Object

try {
    sessionStorage = window.sessionStorage; // This will throw an exception in some browsers when cookies/localStorage are explicitly disabled (i.e. Chrome)
    sessionStorage.setItem('TEST', '1');
    sessionStorage.removeItem('TEST');
} catch (e) {
    sessionStorage = false;
}

// MooTools Compatibility
JSON.stringify = JSON.stringify || JSON.encode;
JSON.parse = JSON.parse || JSON.decode;

// Check Existence
if (typeof History.init === 'undefined') {

    // Initialise History
    History.init = function (options) {
        // Check Load Status of Adapter
        if (typeof History.Adapter === 'undefined') {
            return false;
        }

        // Check Load Status of Core
        if (typeof History.initCore !== 'undefined') {
            History.initCore();
        }

        // Check Load Status of HTML4 Support
        if (typeof History.initHtml4 !== 'undefined') {
            History.initHtml4();
        }

        // Return true
        return true;
    };


    // ========================================================================
    // Initialise Core

    // Initialise Core
    History.initCore = function (options) {
        // Initialise
        if (typeof History.initCore.initialized !== 'undefined') {
            // Already Loaded
            return false;
        }
        else {
            History.initCore.initialized = true;
        }


        // ====================================================================
        // Options

        /**
         * History.options
         * Configurable options
         */
        History.options = History.options || {};

        /**
         * History.options.hashChangeInterval
         * How long should the interval be before hashchange checks
         */
        History.options.hashChangeInterval = History.options.hashChangeInterval || 100;

        /**
         * History.options.safariPollInterval
         * How long should the interval be before safari poll checks
         */
        History.options.safariPollInterval = History.options.safariPollInterval || 500;

        /**
         * History.options.doubleCheckInterval
         * How long should the interval be before we perform a double check
         */
        History.options.doubleCheckInterval = History.options.doubleCheckInterval || 500;

        /**
         * History.options.disableSuid
         * Force History not to append suid
         */
        History.options.disableSuid = History.options.disableSuid || false;

        /**
         * History.options.storeInterval
         * How long should we wait between store calls
         */
        History.options.storeInterval = History.options.storeInterval || 1000;

        /**
         * History.options.busyDelay
         * How long should we wait between busy events
         */
        History.options.busyDelay = History.options.busyDelay || 250;

        /**
         * History.options.debug
         * If true will enable debug messages to be logged
         */
        History.options.debug = History.options.debug || false;

        /**
         * History.options.initialTitle
         * What is the title of the initial state
         */
        History.options.initialTitle = History.options.initialTitle || document.title;

        /**
         * History.options.html4Mode
         * If true, will force HTMl4 mode (hashtags)
         */
        History.options.html4Mode = History.options.html4Mode || false;

        /**
         * History.options.delayInit
         * Want to override default options and call init manually.
         */
        History.options.delayInit = History.options.delayInit || false;


        // ====================================================================
        // Interval record

        /**
         * History.intervalList
         * List of intervals set, to be cleared when document is unloaded.
         */
        History.intervalList = [];

        /**
         * History.clearAllIntervals
         * Clears all setInterval instances.
         */
        History.clearAllIntervals = function () {
            var i, il = History.intervalList;
            if (typeof il !== "undefined" && il !== null) {
                for (i = 0; i < il.length; i++) {
                    clearInterval(il[i]);
                }
                History.intervalList = null;
            }
        };


        // ====================================================================
        // Debug

        /**
         * History.debug(message,...)
         * Logs the passed arguments if debug enabled
         */
        History.debug = function () {
            if ((History.options.debug || false)) {
                History.log.apply(History, arguments);
            }
        };

        /**
         * History.log(message,...)
         * Logs the passed arguments
         */
        History.log = function () {
            // Prepare
            var
                consoleExists = !(typeof console === 'undefined' || typeof console.log === 'undefined' || typeof console.log.apply === 'undefined'),
                textarea = document.getElementById('log'),
                message,
                i, n,
                args, arg
                ;

            // Write to Console
            if (consoleExists) {
                args = Array.prototype.slice.call(arguments);
                message = args.shift();
                if (typeof console.debug !== 'undefined') {
                    console.debug.apply(console, [message, args]);
                }
                else {
                    console.log.apply(console, [message, args]);
                }
            }
            else {
                message = ("\n" + arguments[0] + "\n");
            }

            // Write to log
            for (i = 1, n = arguments.length; i < n; ++i) {
                arg = arguments[i];
                if (typeof arg === 'object' && typeof JSON !== 'undefined') {
                    try {
                        arg = JSON.stringify(arg);
                    }
                    catch (Exception) {
                        // Recursive Object
                    }
                }
                message += "\n" + arg + "\n";
            }

            // Textarea
            if (textarea) {
                textarea.value += message + "\n-----\n";
                textarea.scrollTop = textarea.scrollHeight - textarea.clientHeight;
            }
            // No Textarea, No Console
            else if (!consoleExists) {
                alert(message);
            }

            // Return true
            return true;
        };


        // ====================================================================
        // Emulated Status

        /**
         * History.getInternetExplorerMajorVersion()
         * Get's the major version of Internet Explorer
         * @return {integer}
         * @license Public Domain
         * @author Benjamin Arthur Lupton <contact@balupton.com>
         * @author James Padolsey <https://gist.github.com/527683>
         */
        History.getInternetExplorerMajorVersion = function () {
            var result = History.getInternetExplorerMajorVersion.cached =
                    (typeof History.getInternetExplorerMajorVersion.cached !== 'undefined')
                        ? History.getInternetExplorerMajorVersion.cached
                        : (function () {
                        var v = 3,
                            div = document.createElement('div'),
                            all = div.getElementsByTagName('i');
                        while ((div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->') && all[0]) {
                        }
                        return (v > 4) ? v : false;
                    })()
                ;
            return result;
        };

        /**
         * History.isInternetExplorer()
         * Are we using Internet Explorer?
         * @return {boolean}
         * @license Public Domain
         * @author Benjamin Arthur Lupton <contact@balupton.com>
         */
        History.isInternetExplorer = function () {
            var result =
                    History.isInternetExplorer.cached =
                        (typeof History.isInternetExplorer.cached !== 'undefined')
                            ? History.isInternetExplorer.cached
                            : Boolean(History.getInternetExplorerMajorVersion())
                ;
            return result;
        };

        /**
         * History.emulated
         * Which features require emulating?
         */

        if (History.options.html4Mode) {
            History.emulated = {
                pushState: true,
                hashChange: true
            };
        }

        else {

            History.emulated = {
                pushState: !Boolean(
                    window.history && window.history.pushState && window.history.replaceState
                    && !(
                    (/ Mobile\/([1-7][a-z]|(8([abcde]|f(1[0-8]))))/i).test(navigator.userAgent) /* disable for versions of iOS before version 4.3 (8F190) */
                    || (/AppleWebKit\/5([0-2]|3[0-2])/i).test(navigator.userAgent) /* disable for the mercury iOS browser, or at least older versions of the webkit engine */
                    )
                ),
                hashChange: Boolean(
                    !(('onhashchange' in window) || ('onhashchange' in document))
                    ||
                    (History.isInternetExplorer() && History.getInternetExplorerMajorVersion() < 8)
                )
            };
        }

        /**
         * History.enabled
         * Is History enabled?
         */
        History.enabled = !History.emulated.pushState;

        /**
         * History.bugs
         * Which bugs are present
         */
        History.bugs = {
            /**
             * Safari 5 and Safari iOS 4 fail to return to the correct state once a hash is replaced by a `replaceState` call
             * https://bugs.webkit.org/show_bug.cgi?id=56249
             */
            setHash: Boolean(!History.emulated.pushState && navigator.vendor === 'Apple Computer, Inc.' && /AppleWebKit\/5([0-2]|3[0-3])/.test(navigator.userAgent)),

            /**
             * Safari 5 and Safari iOS 4 sometimes fail to apply the state change under busy conditions
             * https://bugs.webkit.org/show_bug.cgi?id=42940
             */
            safariPoll: Boolean(!History.emulated.pushState && navigator.vendor === 'Apple Computer, Inc.' && /AppleWebKit\/5([0-2]|3[0-3])/.test(navigator.userAgent)),

            /**
             * MSIE 6 and 7 sometimes do not apply a hash even it was told to (requiring a second call to the apply function)
             */
            ieDoubleCheck: Boolean(History.isInternetExplorer() && History.getInternetExplorerMajorVersion() < 8),

            /**
             * MSIE 6 requires the entire hash to be encoded for the hashes to trigger the onHashChange event
             */
            hashEscape: Boolean(History.isInternetExplorer() && History.getInternetExplorerMajorVersion() < 7)
        };

        /**
         * History.isEmptyObject(obj)
         * Checks to see if the Object is Empty
         * @param {Object} obj
         * @return {boolean}
         */
        History.isEmptyObject = function (obj) {
            for (var name in obj) {
                if (obj.hasOwnProperty(name)) {
                    return false;
                }
            }
            return true;
        };

        /**
         * History.cloneObject(obj)
         * Clones a object and eliminate all references to the original contexts
         * @param {Object} obj
         * @return {Object}
         */
        History.cloneObject = function (obj) {
            var hash, newObj;
            if (obj) {
                hash = JSON.stringify(obj);
                newObj = JSON.parse(hash);
            }
            else {
                newObj = {};
            }
            return newObj;
        };


        // ====================================================================
        // URL Helpers

        /**
         * History.getRootUrl()
         * Turns "http://mysite.com/dir/page.html?asd" into "http://mysite.com"
         * @return {String} rootUrl
         */
        History.getRootUrl = function () {
            // Create
            var rootUrl = document.location.protocol + '//' + (document.location.hostname || document.location.host);
            if (document.location.port || false) {
                rootUrl += ':' + document.location.port;
            }
            rootUrl += '/';

            // Return
            return rootUrl;
        };

        /**
         * History.getBaseHref()
         * Fetches the `href` attribute of the `<base href="...">` element if it exists
         * @return {String} baseHref
         */
        History.getBaseHref = function () {
            // Create
            var
                baseElements = document.getElementsByTagName('base'),
                baseElement = null,
                baseHref = '';

            // Test for Base Element
            if (baseElements.length === 1) {
                // Prepare for Base Element
                baseElement = baseElements[0];
                baseHref = baseElement.href.replace(/[^\/]+$/, '');
            }

            // Adjust trailing slash
            baseHref = baseHref.replace(/\/+$/, '');
            if (baseHref) baseHref += '/';

            // Return
            return baseHref;
        };

        /**
         * History.getBaseUrl()
         * Fetches the baseHref or basePageUrl or rootUrl (whichever one exists first)
         * @return {String} baseUrl
         */
        History.getBaseUrl = function () {
            // Create
            var baseUrl = History.getBaseHref() || History.getBasePageUrl() || History.getRootUrl();

            // Return
            return baseUrl;
        };

        /**
         * History.getPageUrl()
         * Fetches the URL of the current page
         * @return {String} pageUrl
         */
        History.getPageUrl = function () {
            // Fetch
            var
                State = History.getState(false, false),
                stateUrl = (State || {}).url || History.getLocationHref(),
                pageUrl;

            // Create
            pageUrl = stateUrl.replace(/\/+$/, '').replace(/[^\/]+$/, function (part, index, string) {
                return (/\./).test(part) ? part : part + '/';
            });

            // Return
            return pageUrl;
        };

        /**
         * History.getBasePageUrl()
         * Fetches the Url of the directory of the current page
         * @return {String} basePageUrl
         */
        History.getBasePageUrl = function () {
            // Create
            var basePageUrl = (History.getLocationHref()).replace(/[#\?].*/, '').replace(/[^\/]+$/, function (part, index, string) {
                    return (/[^\/]$/).test(part) ? '' : part;
                }).replace(/\/+$/, '') + '/';

            // Return
            return basePageUrl;
        };

        /**
         * History.getFullUrl(url)
         * Ensures that we have an absolute URL and not a relative URL
         * @param {string} url
         * @param {Boolean} allowBaseHref
         * @return {string} fullUrl
         */
        History.getFullUrl = function (url, allowBaseHref) {
            // Prepare
            var fullUrl = url, firstChar = url.substring(0, 1);
            allowBaseHref = (typeof allowBaseHref === 'undefined') ? true : allowBaseHref;

            // Check
            if (/[a-z]+\:\/\//.test(url)) {
                // Full URL
            }
            else if (firstChar === '/') {
                // Root URL
                fullUrl = History.getRootUrl() + url.replace(/^\/+/, '');
            }
            else if (firstChar === '#') {
                // Anchor URL
                fullUrl = History.getPageUrl().replace(/#.*/, '') + url;
            }
            else if (firstChar === '?') {
                // Query URL
                fullUrl = History.getPageUrl().replace(/[\?#].*/, '') + url;
            }
            else {
                // Relative URL
                if (allowBaseHref) {
                    fullUrl = History.getBaseUrl() + url.replace(/^(\.\/)+/, '');
                } else {
                    fullUrl = History.getBasePageUrl() + url.replace(/^(\.\/)+/, '');
                }
                // We have an if condition above as we do not want hashes
                // which are relative to the baseHref in our URLs
                // as if the baseHref changes, then all our bookmarks
                // would now point to different locations
                // whereas the basePageUrl will always stay the same
            }

            // Return
            return fullUrl.replace(/\#$/, '');
        };

        /**
         * History.getShortUrl(url)
         * Ensures that we have a relative URL and not a absolute URL
         * @param {string} url
         * @return {string} url
         */
        History.getShortUrl = function (url) {
            // Prepare
            var shortUrl = url, baseUrl = History.getBaseUrl(), rootUrl = History.getRootUrl();

            // Trim baseUrl
            if (History.emulated.pushState) {
                // We are in a if statement as when pushState is not emulated
                // The actual url these short urls are relative to can change
                // So within the same session, we the url may end up somewhere different
                shortUrl = shortUrl.replace(baseUrl, '');
            }

            // Trim rootUrl
            shortUrl = shortUrl.replace(rootUrl, '/');

            // Ensure we can still detect it as a state
            if (History.isTraditionalAnchor(shortUrl)) {
                shortUrl = './' + shortUrl;
            }

            // Clean It
            shortUrl = shortUrl.replace(/^(\.\/)+/g, './').replace(/\#$/, '');

            // Return
            return shortUrl;
        };

        /**
         * History.getLocationHref(document)
         * Returns a normalized version of document.location.href
         * accounting for browser inconsistencies, etc.
         *
         * This URL will be URI-encoded and will include the hash
         *
         * @param {object} document
         * @return {string} url
         */
        History.getLocationHref = function (doc) {
            doc = doc || document;

            // most of the time, this will be true
            if (doc.URL === doc.location.href)
                return doc.location.href;

            // some versions of webkit URI-decode document.location.href
            // but they leave document.URL in an encoded state
            if (doc.location.href === decodeURIComponent(doc.URL))
                return doc.URL;

            // FF 3.6 only updates document.URL when a page is reloaded
            // document.location.href is updated correctly
            if (doc.location.hash && decodeURIComponent(doc.location.href.replace(/^[^#]+/, "")) === doc.location.hash)
                return doc.location.href;

            if (doc.URL.indexOf('#') == -1 && doc.location.href.indexOf('#') != -1)
                return doc.location.href;

            return doc.URL || doc.location.href;
        };


        // ====================================================================
        // State Storage

        /**
         * History.store
         * The store for all session specific data
         */
        History.store = {};

        /**
         * History.idToState
         * 1-1: State ID to State Object
         */
        History.idToState = History.idToState || {};

        /**
         * History.stateToId
         * 1-1: State String to State ID
         */
        History.stateToId = History.stateToId || {};

        /**
         * History.urlToId
         * 1-1: State URL to State ID
         */
        History.urlToId = History.urlToId || {};

        /**
         * History.storedStates
         * Store the states in an array
         */
        History.storedStates = History.storedStates || [];

        /**
         * History.savedStates
         * Saved the states in an array
         */
        History.savedStates = History.savedStates || [];

        /**
         * History.noramlizeStore()
         * Noramlize the store by adding necessary values
         */
        History.normalizeStore = function () {
            History.store.idToState = History.store.idToState || {};
            History.store.urlToId = History.store.urlToId || {};
            History.store.stateToId = History.store.stateToId || {};
        };

        /**
         * History.getState()
         * Get an object containing the data, title and url of the current state
         * @param {Boolean} friendly
         * @param {Boolean} create
         * @return {Object} State
         */
        History.getState = function (friendly, create) {
            // Prepare
            if (typeof friendly === 'undefined') {
                friendly = true;
            }
            if (typeof create === 'undefined') {
                create = true;
            }

            // Fetch
            var State = History.getLastSavedState();

            // Create
            if (!State && create) {
                State = History.createStateObject();
            }

            // Adjust
            if (friendly) {
                State = History.cloneObject(State);
                State.url = State.cleanUrl || State.url;
            }

            // Return
            return State;
        };

        /**
         * History.getIdByState(State)
         * Gets a ID for a State
         * @param {State} newState
         * @return {String} id
         */
        History.getIdByState = function (newState) {

            // Fetch ID
            var id = History.extractId(newState.url),
                str;

            if (!id) {
                // Find ID via State String
                str = History.getStateString(newState);
                if (typeof History.stateToId[str] !== 'undefined') {
                    id = History.stateToId[str];
                }
                else if (typeof History.store.stateToId[str] !== 'undefined') {
                    id = History.store.stateToId[str];
                }
                else {
                    // Generate a new ID
                    while (true) {
                        id = (new Date()).getTime() + String(Math.random()).replace(/\D/g, '');
                        if (typeof History.idToState[id] === 'undefined' && typeof History.store.idToState[id] === 'undefined') {
                            break;
                        }
                    }

                    // Apply the new State to the ID
                    History.stateToId[str] = id;
                    History.idToState[id] = newState;
                }
            }

            // Return ID
            return id;
        };

        /**
         * History.normalizeState(State)
         * Expands a State Object
         * @param {object} State
         * @return {object}
         */
        History.normalizeState = function (oldState) {
            // Variables
            var newState, dataNotEmpty;

            // Prepare
            if (!oldState || (typeof oldState !== 'object')) {
                oldState = {};
            }

            // Check
            if (typeof oldState.normalized !== 'undefined') {
                return oldState;
            }

            // Adjust
            if (!oldState.data || (typeof oldState.data !== 'object')) {
                oldState.data = {};
            }

            // ----------------------------------------------------------------

            // Create
            newState = {};
            newState.normalized = true;
            newState.title = oldState.title || '';
            newState.url = History.getFullUrl(oldState.url ? oldState.url : (History.getLocationHref()));
            newState.hash = History.getShortUrl(newState.url);
            newState.data = History.cloneObject(oldState.data);

            // Fetch ID
            newState.id = History.getIdByState(newState);

            // ----------------------------------------------------------------

            // Clean the URL
            newState.cleanUrl = newState.url.replace(/\??\&_suid.*/, '');
            newState.url = newState.cleanUrl;

            // Check to see if we have more than just a url
            dataNotEmpty = !History.isEmptyObject(newState.data);

            // Apply
            if ((newState.title || dataNotEmpty) && History.options.disableSuid !== true) {
                // Add ID to Hash
                newState.hash = History.getShortUrl(newState.url).replace(/\??\&_suid.*/, '');
                if (!/\?/.test(newState.hash)) {
                    newState.hash += '?';
                }
                newState.hash += '&_suid=' + newState.id;
            }

            // Create the Hashed URL
            newState.hashedUrl = History.getFullUrl(newState.hash);

            // ----------------------------------------------------------------

            // Update the URL if we have a duplicate
            if ((History.emulated.pushState || History.bugs.safariPoll) && History.hasUrlDuplicate(newState)) {
                newState.url = newState.hashedUrl;
            }

            // ----------------------------------------------------------------

            // Return
            return newState;
        };

        /**
         * History.createStateObject(data,title,url)
         * Creates a object based on the data, title and url state params
         * @param {object} data
         * @param {string} title
         * @param {string} url
         * @return {object}
         */
        History.createStateObject = function (data, title, url) {
            // Hashify
            var State = {
                'data': data,
                'title': title,
                'url': url
            };

            // Expand the State
            State = History.normalizeState(State);

            // Return object
            return State;
        };

        /**
         * History.getStateById(id)
         * Get a state by it's UID
         * @param {String} id
         */
        History.getStateById = function (id) {
            // Prepare
            id = String(id);

            // Retrieve
            var State = History.idToState[id] || History.store.idToState[id] || undefined;

            // Return State
            return State;
        };

        /**
         * Get a State's String
         * @param {State} passedState
         */
        History.getStateString = function (passedState) {
            // Prepare
            var State, cleanedState, str;

            // Fetch
            State = History.normalizeState(passedState);

            // Clean
            cleanedState = {
                data: State.data,
                title: passedState.title,
                url: passedState.url
            };

            // Fetch
            str = JSON.stringify(cleanedState);

            // Return
            return str;
        };

        /**
         * Get a State's ID
         * @param {State} passedState
         * @return {String} id
         */
        History.getStateId = function (passedState) {
            // Prepare
            var State, id;

            // Fetch
            State = History.normalizeState(passedState);

            // Fetch
            id = State.id;

            // Return
            return id;
        };

        /**
         * History.getHashByState(State)
         * Creates a Hash for the State Object
         * @param {State} passedState
         * @return {String} hash
         */
        History.getHashByState = function (passedState) {
            // Prepare
            var State, hash;

            // Fetch
            State = History.normalizeState(passedState);

            // Hash
            hash = State.hash;

            // Return
            return hash;
        };

        /**
         * History.extractId(url_or_hash)
         * Get a State ID by it's URL or Hash
         * @param {string} url_or_hash
         * @return {string} id
         */
        History.extractId = function (url_or_hash) {
            // Prepare
            var id, parts, url, tmp;

            // Extract

            // If the URL has a #, use the id from before the #
            if (url_or_hash.indexOf('#') != -1) {
                tmp = url_or_hash.split("#")[0];
            }
            else {
                tmp = url_or_hash;
            }

            parts = /(.*)\&_suid=([0-9]+)$/.exec(tmp);
            url = parts ? (parts[1] || url_or_hash) : url_or_hash;
            id = parts ? String(parts[2] || '') : '';

            // Return
            return id || false;
        };

        /**
         * History.isTraditionalAnchor
         * Checks to see if the url is a traditional anchor or not
         * @param {String} url_or_hash
         * @return {Boolean}
         */
        History.isTraditionalAnchor = function (url_or_hash) {
            // Check
            var isTraditional = !(/[\/\?\.]/.test(url_or_hash));

            // Return
            return isTraditional;
        };

        /**
         * History.extractState
         * Get a State by it's URL or Hash
         * @param {String} url_or_hash
         * @return {State|null}
         */
        History.extractState = function (url_or_hash, create) {
            // Prepare
            var State = null, id, url;
            create = create || false;

            // Fetch SUID
            id = History.extractId(url_or_hash);
            if (id) {
                State = History.getStateById(id);
            }

            // Fetch SUID returned no State
            if (!State) {
                // Fetch URL
                url = History.getFullUrl(url_or_hash);

                // Check URL
                id = History.getIdByUrl(url) || false;
                if (id) {
                    State = History.getStateById(id);
                }

                // Create State
                if (!State && create && !History.isTraditionalAnchor(url_or_hash)) {
                    State = History.createStateObject(null, null, url);
                }
            }

            // Return
            return State;
        };

        /**
         * History.getIdByUrl()
         * Get a State ID by a State URL
         */
        History.getIdByUrl = function (url) {
            // Fetch
            var id = History.urlToId[url] || History.store.urlToId[url] || undefined;

            // Return
            return id;
        };

        /**
         * History.getLastSavedState()
         * Get an object containing the data, title and url of the current state
         * @return {Object} State
         */
        History.getLastSavedState = function () {
            return History.savedStates[History.savedStates.length - 1] || undefined;
        };

        /**
         * History.getLastStoredState()
         * Get an object containing the data, title and url of the current state
         * @return {Object} State
         */
        History.getLastStoredState = function () {
            return History.storedStates[History.storedStates.length - 1] || undefined;
        };

        /**
         * History.hasUrlDuplicate
         * Checks if a Url will have a url conflict
         * @param {Object} newState
         * @return {Boolean} hasDuplicate
         */
        History.hasUrlDuplicate = function (newState) {
            // Prepare
            var hasDuplicate = false,
                oldState;

            // Fetch
            oldState = History.extractState(newState.url);

            // Check
            hasDuplicate = oldState && oldState.id !== newState.id;

            // Return
            return hasDuplicate;
        };

        /**
         * History.storeState
         * Store a State
         * @param {Object} newState
         * @return {Object} newState
         */
        History.storeState = function (newState) {
            // Store the State
            History.urlToId[newState.url] = newState.id;

            // Push the State
            History.storedStates.push(History.cloneObject(newState));

            // Return newState
            return newState;
        };

        /**
         * History.isLastSavedState(newState)
         * Tests to see if the state is the last state
         * @param {Object} newState
         * @return {boolean} isLast
         */
        History.isLastSavedState = function (newState) {
            // Prepare
            var isLast = false,
                newId, oldState, oldId;

            // Check
            if (History.savedStates.length) {
                newId = newState.id;
                oldState = History.getLastSavedState();
                oldId = oldState.id;

                // Check
                isLast = (newId === oldId);
            }

            // Return
            return isLast;
        };

        /**
         * History.saveState
         * Push a State
         * @param {Object} newState
         * @return {boolean} changed
         */
        History.saveState = function (newState) {
            // Check Hash
            if (History.isLastSavedState(newState)) {
                return false;
            }

            // Push the State
            History.savedStates.push(History.cloneObject(newState));

            // Return true
            return true;
        };

        /**
         * History.getStateByIndex()
         * Gets a state by the index
         * @param {integer} index
         * @return {Object}
         */
        History.getStateByIndex = function (index) {
            // Prepare
            var State = null;

            // Handle
            if (typeof index === 'undefined') {
                // Get the last inserted
                State = History.savedStates[History.savedStates.length - 1];
            }
            else if (index < 0) {
                // Get from the end
                State = History.savedStates[History.savedStates.length + index];
            }
            else {
                // Get from the beginning
                State = History.savedStates[index];
            }

            // Return State
            return State;
        };

        /**
         * History.getCurrentIndex()
         * Gets the current index
         * @return (integer)
         */
        History.getCurrentIndex = function () {
            // Prepare
            var index = null;

            // No states saved
            if (History.savedStates.length < 1) {
                index = 0;
            }
            else {
                index = History.savedStates.length - 1;
            }
            return index;
        };

        // ====================================================================
        // Hash Helpers

        /**
         * History.getHash()
         * @param {Location=} location
         * Gets the current document hash
         * Note: unlike location.hash, this is guaranteed to return the escaped hash in all browsers
         * @return {string}
         */
        History.getHash = function (doc) {
            var url = History.getLocationHref(doc),
                hash;
            hash = History.getHashByUrl(url);
            return hash;
        };

        /**
         * History.unescapeHash()
         * normalize and Unescape a Hash
         * @param {String} hash
         * @return {string}
         */
        History.unescapeHash = function (hash) {
            // Prepare
            var result = History.normalizeHash(hash);

            // Unescape hash
            result = decodeURIComponent(result);

            // Return result
            return result;
        };

        /**
         * History.normalizeHash()
         * normalize a hash across browsers
         * @return {string}
         */
        History.normalizeHash = function (hash) {
            // Prepare
            var result = hash.replace(/[^#]*#/, '').replace(/#.*/, '');

            // Return result
            return result;
        };

        /**
         * History.setHash(hash)
         * Sets the document hash
         * @param {string} hash
         * @return {History}
         */
        History.setHash = function (hash, queue) {
            // Prepare
            var State, pageUrl;

            // Handle Queueing
            if (queue !== false && History.busy()) {
                // Wait + Push to Queue
                //History.debug('History.setHash: we must wait', arguments);
                History.pushQueue({
                    scope: History,
                    callback: History.setHash,
                    args: arguments,
                    queue: queue
                });
                return false;
            }

            // Log
            //History.debug('History.setHash: called',hash);

            // Make Busy + Continue
            History.busy(true);

            // Check if hash is a state
            State = History.extractState(hash, true);
            if (State && !History.emulated.pushState) {
                // Hash is a state so skip the setHash
                //History.debug('History.setHash: Hash is a state so skipping the hash set with a direct pushState call',arguments);

                // PushState
                History.pushState(State.data, State.title, State.url, false);
            }
            else if (History.getHash() !== hash) {
                // Hash is a proper hash, so apply it

                // Handle browser bugs
                if (History.bugs.setHash) {
                    // Fix Safari Bug https://bugs.webkit.org/show_bug.cgi?id=56249

                    // Fetch the base page
                    pageUrl = History.getPageUrl();

                    // Safari hash apply
                    History.pushState(null, null, pageUrl + '#' + hash, false);
                }
                else {
                    // Normal hash apply
                    document.location.hash = hash;
                }
            }

            // Chain
            return History;
        };

        /**
         * History.escape()
         * normalize and Escape a Hash
         * @return {string}
         */
        History.escapeHash = function (hash) {
            // Prepare
            var result = History.normalizeHash(hash);

            // Escape hash
            result = window.encodeURIComponent(result);

            // IE6 Escape Bug
            if (!History.bugs.hashEscape) {
                // Restore common parts
                result = result
                    .replace(/\%21/g, '!')
                    .replace(/\%26/g, '&')
                    .replace(/\%3D/g, '=')
                    .replace(/\%3F/g, '?');
            }

            // Return result
            return result;
        };

        /**
         * History.getHashByUrl(url)
         * Extracts the Hash from a URL
         * @param {string} url
         * @return {string} url
         */
        History.getHashByUrl = function (url) {
            // Extract the hash
            var hash = String(url)
                    .replace(/([^#]*)#?([^#]*)#?(.*)/, '$2')
                ;

            // Unescape hash
            hash = History.unescapeHash(hash);

            // Return hash
            return hash;
        };

        /**
         * History.setTitle(title)
         * Applies the title to the document
         * @param {State} newState
         * @return {Boolean}
         */
        History.setTitle = function (newState) {
            // Prepare
            var title = newState.title,
                firstState;

            // Initial
            if (!title) {
                firstState = History.getStateByIndex(0);
                if (firstState && firstState.url === newState.url) {
                    title = firstState.title || History.options.initialTitle;
                }
            }

            // Apply
            try {
                document.getElementsByTagName('title')[0].innerHTML = title.replace('<', '&lt;').replace('>', '&gt;').replace(' & ', ' &amp; ');
            }
            catch (Exception) {
            }
            document.title = title;

            // Chain
            return History;
        };


        // ====================================================================
        // Queueing

        /**
         * History.queues
         * The list of queues to use
         * First In, First Out
         */
        History.queues = [];

        /**
         * History.busy(value)
         * @param {boolean} value [optional]
         * @return {boolean} busy
         */
        History.busy = function (value) {
            // Apply
            if (typeof value !== 'undefined') {
                //History.debug('History.busy: changing ['+(History.busy.flag||false)+'] to ['+(value||false)+']', History.queues.length);
                History.busy.flag = value;
            }
            // Default
            else if (typeof History.busy.flag === 'undefined') {
                History.busy.flag = false;
            }

            // Queue
            if (!History.busy.flag) {
                // Execute the next item in the queue
                clearTimeout(History.busy.timeout);
                var fireNext = function () {
                    var i, queue, item;
                    if (History.busy.flag) return;
                    for (i = History.queues.length - 1; i >= 0; --i) {
                        queue = History.queues[i];
                        if (queue.length === 0) continue;
                        item = queue.shift();
                        History.fireQueueItem(item);
                        History.busy.timeout = setTimeout(fireNext, History.options.busyDelay);
                    }
                };
                History.busy.timeout = setTimeout(fireNext, History.options.busyDelay);
            }

            // Return
            return History.busy.flag;
        };

        /**
         * History.busy.flag
         */
        History.busy.flag = false;

        /**
         * History.fireQueueItem(item)
         * Fire a Queue Item
         * @param {Object} item
         * @return {Mixed} result
         */
        History.fireQueueItem = function (item) {
            return item.callback.apply(item.scope || History, item.args || []);
        };

        /**
         * History.pushQueue(callback,args)
         * Add an item to the queue
         * @param {Object} item [scope,callback,args,queue]
         */
        History.pushQueue = function (item) {
            // Prepare the queue
            History.queues[item.queue || 0] = History.queues[item.queue || 0] || [];

            // Add to the queue
            History.queues[item.queue || 0].push(item);

            // Chain
            return History;
        };

        /**
         * History.queue (item,queue), (func,queue), (func), (item)
         * Either firs the item now if not busy, or adds it to the queue
         */
        History.queue = function (item, queue) {
            // Prepare
            if (typeof item === 'function') {
                item = {
                    callback: item
                };
            }
            if (typeof queue !== 'undefined') {
                item.queue = queue;
            }

            // Handle
            if (History.busy()) {
                History.pushQueue(item);
            } else {
                History.fireQueueItem(item);
            }

            // Chain
            return History;
        };

        /**
         * History.clearQueue()
         * Clears the Queue
         */
        History.clearQueue = function () {
            History.busy.flag = false;
            History.queues = [];
            return History;
        };


        // ====================================================================
        // IE Bug Fix

        /**
         * History.stateChanged
         * States whether or not the state has changed since the last double check was initialised
         */
        History.stateChanged = false;

        /**
         * History.doubleChecker
         * Contains the timeout used for the double checks
         */
        History.doubleChecker = false;

        /**
         * History.doubleCheckComplete()
         * Complete a double check
         * @return {History}
         */
        History.doubleCheckComplete = function () {
            // Update
            History.stateChanged = true;

            // Clear
            History.doubleCheckClear();

            // Chain
            return History;
        };

        /**
         * History.doubleCheckClear()
         * Clear a double check
         * @return {History}
         */
        History.doubleCheckClear = function () {
            // Clear
            if (History.doubleChecker) {
                clearTimeout(History.doubleChecker);
                History.doubleChecker = false;
            }

            // Chain
            return History;
        };

        /**
         * History.doubleCheck()
         * Create a double check
         * @return {History}
         */
        History.doubleCheck = function (tryAgain) {
            // Reset
            History.stateChanged = false;
            History.doubleCheckClear();

            // Fix IE6,IE7 bug where calling history.back or history.forward does not actually change the hash (whereas doing it manually does)
            // Fix Safari 5 bug where sometimes the state does not change: https://bugs.webkit.org/show_bug.cgi?id=42940
            if (History.bugs.ieDoubleCheck) {
                // Apply Check
                History.doubleChecker = setTimeout(
                    function () {
                        History.doubleCheckClear();
                        if (!History.stateChanged) {
                            //History.debug('History.doubleCheck: State has not yet changed, trying again', arguments);
                            // Re-Attempt
                            tryAgain();
                        }
                        return true;
                    },
                    History.options.doubleCheckInterval
                );
            }

            // Chain
            return History;
        };


        // ====================================================================
        // Safari Bug Fix

        /**
         * History.safariStatePoll()
         * Poll the current state
         * @return {History}
         */
        History.safariStatePoll = function () {
            // Poll the URL

            // Get the Last State which has the new URL
            var
                urlState = History.extractState(History.getLocationHref()),
                newState;

            // Check for a difference
            if (!History.isLastSavedState(urlState)) {
                newState = urlState;
            }
            else {
                return;
            }

            // Check if we have a state with that url
            // If not create it
            if (!newState) {
                //History.debug('History.safariStatePoll: new');
                newState = History.createStateObject();
            }

            // Apply the New State
            //History.debug('History.safariStatePoll: trigger');
            History.Adapter.trigger(window, 'popstate');

            // Chain
            return History;
        };


        // ====================================================================
        // State Aliases

        /**
         * History.back(queue)
         * Send the browser history back one item
         * @param {Integer} queue [optional]
         */
        History.back = function (queue) {
            //History.debug('History.back: called', arguments);

            // Handle Queueing
            if (queue !== false && History.busy()) {
                // Wait + Push to Queue
                //History.debug('History.back: we must wait', arguments);
                History.pushQueue({
                    scope: History,
                    callback: History.back,
                    args: arguments,
                    queue: queue
                });
                return false;
            }

            // Make Busy + Continue
            History.busy(true);

            // Fix certain browser bugs that prevent the state from changing
            History.doubleCheck(function () {
                History.back(false);
            });

            // Go back
            history.go(-1);

            // End back closure
            return true;
        };

        /**
         * History.forward(queue)
         * Send the browser history forward one item
         * @param {Integer} queue [optional]
         */
        History.forward = function (queue) {
            //History.debug('History.forward: called', arguments);

            // Handle Queueing
            if (queue !== false && History.busy()) {
                // Wait + Push to Queue
                //History.debug('History.forward: we must wait', arguments);
                History.pushQueue({
                    scope: History,
                    callback: History.forward,
                    args: arguments,
                    queue: queue
                });
                return false;
            }

            // Make Busy + Continue
            History.busy(true);

            // Fix certain browser bugs that prevent the state from changing
            History.doubleCheck(function () {
                History.forward(false);
            });

            // Go forward
            history.go(1);

            // End forward closure
            return true;
        };

        /**
         * History.go(index,queue)
         * Send the browser history back or forward index times
         * @param {Integer} queue [optional]
         */
        History.go = function (index, queue) {
            //History.debug('History.go: called', arguments);

            // Prepare
            var i;

            // Handle
            if (index > 0) {
                // Forward
                for (i = 1; i <= index; ++i) {
                    History.forward(queue);
                }
            }
            else if (index < 0) {
                // Backward
                for (i = -1; i >= index; --i) {
                    History.back(queue);
                }
            }
            else {
                throw new Error('History.go: History.go requires a positive or negative integer passed.');
            }

            // Chain
            return History;
        };


        // ====================================================================
        // HTML5 State Support

        // Non-Native pushState Implementation
        if (History.emulated.pushState) {
            /*
             * Provide Skeleton for HTML4 Browsers
             */

            // Prepare
            var emptyFunction = function () {};
            History.pushState = History.pushState || emptyFunction;
            History.replaceState = History.replaceState || emptyFunction;
        } // History.emulated.pushState

        // Native pushState Implementation
        else {
            /*
             * Use native HTML5 History API Implementation
             */

            /**
             * History.onPopState(event,extra)
             * Refresh the Current State
             */
            History.onPopState = function (event, extra) {
                // Prepare
                var stateId = false, newState = false, currentHash, currentState;

                // Reset the double check
                History.doubleCheckComplete();

                // Check for a Hash, and handle apporiatly
                currentHash = History.getHash();
                if (currentHash) {
                    // Expand Hash
                    currentState = History.extractState(currentHash || History.getLocationHref(), true);
                    if (currentState) {
                        // We were able to parse it, it must be a State!
                        // Let's forward to replaceState
                        //History.debug('History.onPopState: state anchor', currentHash, currentState);
                        History.replaceState(currentState.data, currentState.title, currentState.url, false);
                    }
                    else {
                        // Traditional Anchor
                        //History.debug('History.onPopState: traditional anchor', currentHash);
                        History.Adapter.trigger(window, 'anchorchange');
                        History.busy(false);
                    }

                    // We don't care for hashes
                    History.expectedStateId = false;
                    return false;
                }

                // Ensure
                stateId = History.Adapter.extractEventData('state', event, extra) || false;

                // Fetch State
                if (stateId) {
                    // Vanilla: Back/forward button was used
                    newState = History.getStateById(stateId);
                }
                else if (History.expectedStateId) {
                    // Vanilla: A new state was pushed, and popstate was called manually
                    newState = History.getStateById(History.expectedStateId);
                }
                else {
                    // Initial State
                    newState = History.extractState(History.getLocationHref());
                }

                // The State did not exist in our store
                if (!newState) {
                    // Regenerate the State
                    newState = History.createStateObject(null, null, History.getLocationHref());
                }

                // Clean
                History.expectedStateId = false;

                // Check if we are the same state
                if (History.isLastSavedState(newState)) {
                    // There has been no change (just the page's hash has finally propagated)
                    //History.debug('History.onPopState: no change', newState, History.savedStates);
                    History.busy(false);
                    return false;
                }

                // Store the State
                History.storeState(newState);
                History.saveState(newState);

                // Force update of the title
                History.setTitle(newState);

                // Fire Our Event
                History.Adapter.trigger(window, 'statechange');
                History.busy(false);

                // Return true
                return true;
            };
            History.Adapter.bind(window, 'popstate', History.onPopState);

            /**
             * History.pushState(data,title,url)
             * Add a new State to the history object, become it, and trigger onpopstate
             * We have to trigger for HTML4 compatibility
             * @param {object} data
             * @param {string} title
             * @param {string} url
             * @return {true}
             */
            History.pushState = function (data, title, url, queue) {
                //History.debug('History.pushState: called', arguments);

                // Check the State
                if (History.getHashByUrl(url) && History.emulated.pushState) {
                    throw new Error('History.js does not support states with fragement-identifiers (hashes/anchors).');
                }

                // Handle Queueing
                if (queue !== false && History.busy()) {
                    // Wait + Push to Queue
                    //History.debug('History.pushState: we must wait', arguments);
                    History.pushQueue({
                        scope: History,
                        callback: History.pushState,
                        args: arguments,
                        queue: queue
                    });
                    return false;
                }

                // Make Busy + Continue
                History.busy(true);

                // Create the newState
                var newState = History.createStateObject(data, title, url);

                // Check it
                if (History.isLastSavedState(newState)) {
                    // Won't be a change
                    History.busy(false);
                }
                else {
                    // Store the newState
                    History.storeState(newState);
                    History.expectedStateId = newState.id;

                    // Push the newState
                    history.pushState(newState.id, newState.title, newState.url);

                    // Fire HTML5 Event
                    History.Adapter.trigger(window, 'popstate');
                }

                // End pushState closure
                return true;
            };

            /**
             * History.replaceState(data,title,url)
             * Replace the State and trigger onpopstate
             * We have to trigger for HTML4 compatibility
             * @param {object} data
             * @param {string} title
             * @param {string} url
             * @return {true}
             */
            History.replaceState = function (data, title, url, queue) {
                //History.debug('History.replaceState: called', arguments);

                // Check the State
                if (History.getHashByUrl(url) && History.emulated.pushState) {
                    throw new Error('History.js does not support states with fragement-identifiers (hashes/anchors).');
                }

                // Handle Queueing
                if (queue !== false && History.busy()) {
                    // Wait + Push to Queue
                    //History.debug('History.replaceState: we must wait', arguments);
                    History.pushQueue({
                        scope: History,
                        callback: History.replaceState,
                        args: arguments,
                        queue: queue
                    });
                    return false;
                }

                // Make Busy + Continue
                History.busy(true);

                // Create the newState
                var newState = History.createStateObject(data, title, url);

                // Check it
                if (History.isLastSavedState(newState)) {
                    // Won't be a change
                    History.busy(false);
                }
                else {
                    // Store the newState
                    History.storeState(newState);
                    History.expectedStateId = newState.id;

                    // Push the newState
                    history.replaceState(newState.id, newState.title, newState.url);

                    // Fire HTML5 Event
                    History.Adapter.trigger(window, 'popstate');
                }

                // End replaceState closure
                return true;
            };

        } // !History.emulated.pushState


        // ====================================================================
        // Initialise

        /**
         * Load the Store
         */
        if (sessionStorage) {
            // Fetch
            try {
                History.store = JSON.parse(sessionStorage.getItem('History.store')) || {};
            }
            catch (err) {
                History.store = {};
            }

            // Normalize
            History.normalizeStore();
        }
        else {
            // Default Load
            History.store = {};
            History.normalizeStore();
        }

        /**
         * Clear Intervals on exit to prevent memory leaks
         */
        History.Adapter.bind(window, "unload", History.clearAllIntervals);

        /**
         * Create the initial State
         */
        History.saveState(History.storeState(History.extractState(History.getLocationHref(), true)));

        /**
         * Bind for Saving Store
         */
        if (sessionStorage) {
            // When the page is closed
            History.onUnload = function () {
                // Prepare
                var currentStore, item, currentStoreString;

                // Fetch
                try {
                    currentStore = JSON.parse(sessionStorage.getItem('History.store')) || {};
                }
                catch (err) {
                    currentStore = {};
                }

                // Ensure
                currentStore.idToState = currentStore.idToState || {};
                currentStore.urlToId = currentStore.urlToId || {};
                currentStore.stateToId = currentStore.stateToId || {};

                // Sync
                for (item in History.idToState) {
                    if (!History.idToState.hasOwnProperty(item)) {
                        continue;
                    }
                    currentStore.idToState[item] = History.idToState[item];
                }
                for (item in History.urlToId) {
                    if (!History.urlToId.hasOwnProperty(item)) {
                        continue;
                    }
                    currentStore.urlToId[item] = History.urlToId[item];
                }
                for (item in History.stateToId) {
                    if (!History.stateToId.hasOwnProperty(item)) {
                        continue;
                    }
                    currentStore.stateToId[item] = History.stateToId[item];
                }

                // Update
                History.store = currentStore;
                History.normalizeStore();

                // In Safari, going into Private Browsing mode causes the
                // Session Storage object to still exist but if you try and use
                // or set any property/function of it it throws the exception
                // "QUOTA_EXCEEDED_ERR: DOM Exception 22: An attempt was made to
                // add something to storage that exceeded the quota." infinitely
                // every second.
                currentStoreString = JSON.stringify(currentStore);
                try {
                    // Store
                    sessionStorage.setItem('History.store', currentStoreString);
                }
                catch (e) {
                    if (e.code === DOMException.QUOTA_EXCEEDED_ERR) {
                        if (sessionStorage.length) {
                            // Workaround for a bug seen on iPads. Sometimes the quota exceeded error comes up and simply
                            // removing/resetting the storage can work.
                            sessionStorage.removeItem('History.store');
                            sessionStorage.setItem('History.store', currentStoreString);
                        } else {
                            // Otherwise, we're probably private browsing in Safari, so we'll ignore the exception.
                        }
                    } else {
                        throw e;
                    }
                }
            };

            // For Internet Explorer
            History.isInternetExplorer() && History.intervalList.push(setInterval(History.onUnload, History.options.storeInterval));

            // For Other Browsers
            History.Adapter.bind(window, 'beforeunload', History.onUnload);
            History.Adapter.bind(window, 'unload', History.onUnload);

            // Both are enabled for consistency
        }

        // Non-Native pushState Implementation
        if (!History.emulated.pushState) {
            // Be aware, the following is only for native pushState implementations
            // If you are wanting to include something for all browsers
            // Then include it above this if block

            /**
             * Setup Safari Fix
             */
            if (History.bugs.safariPoll) {
                History.intervalList.push(setInterval(History.safariStatePoll, History.options.safariPollInterval));
            }

            /**
             * Ensure Cross Browser Compatibility
             */
            if (navigator.vendor === 'Apple Computer, Inc.' || (navigator.appCodeName || '') === 'Mozilla') {
                /**
                 * Fix Safari HashChange Issue
                 */

                    // Setup Alias
                History.Adapter.bind(window, 'hashchange', function () {
                    History.Adapter.trigger(window, 'popstate');
                });

                // Initialise Alias
                if (History.getHash()) {
                    History.Adapter.onDomLoad(function () {
                        History.Adapter.trigger(window, 'hashchange');
                    });
                }
            }

        } // !History.emulated.pushState


    }; // History.initCore

    // Try to Initialise History
    if (!History.options || !History.options.delayInit) {
        History.init();
    }
}

module.exports = History;
},{"./history-adapter":67}],69:[function(require,module,exports){
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
        || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
                timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

module.exports = {};
},{}],70:[function(require,module,exports){
var prime      = require('prime'),
    deepClone  = require('mout/lang/deepClone');

//var objectDiff = require('objectdiff');

var SaveState = new prime({

    constructor: function(session) {
        session = deepClone(session);
        this.setSession(session);
    },

    setSession: function(session) {
        session = !session ? {}
            : {
            time: +(new Date()),
            data: deepClone(session)
        };

        this.session = session;
        return this.session;
    },

    getTime: function() {
        return this.session.time;
    },

    getData: function() {
        return this.session.data;
    },

    getSession: function() {
        return this.session;
    },

    getDiff: function(data) {
        // Unsupported at this state
        return data;
        /*
        var diff = objectDiff.diff(this.getData(), data);
        return {
            diff: diff,
            xml: objectDiff.convertToXMLString(diff)
        };
        */
    }
});

module.exports = SaveState;

},{"mout/lang/deepClone":168,"prime":267}],71:[function(require,module,exports){
/*
Agent
- heavily inspired by superagent by visionmedia https://github.com/visionmedia/superagent, released under the MIT license
- code derived from MooTools 1.4 Request.js && superagent
- MIT-License
*/"use strict";
/* global ActiveXObject */

var prime   = require("prime"),
    Emitter = require("prime/emitter")

var isObject   = require("mout/lang/isObject"),
    isString   = require("mout/lang/isString"),
    isArray    = require("mout/lang/isArray"),
    isFunction = require("mout/lang/isFunction"),
    trim       = require("mout/string/trim"),
    upperCase  = require("mout/string/upperCase"),
    forIn      = require("mout/object/forIn"),
    mixIn      = require("mout/object/mixIn"),
    remove     = require("mout/array/remove"),
    forEach    = require("mout/array/forEach")

var capitalize = function(str){
    return str.replace(/\b[a-z]/g, upperCase)
}

// MooTools

var getRequest = (function(){

    var XMLHTTP = function(){
        return new XMLHttpRequest()
    }, MSXML2 = function(){
        return new ActiveXObject("MSXML2.XMLHTTP")
    }, MSXML = function(){
        return new ActiveXObject("Microsoft.XMLHTTP")
    }

    try {
      XMLHTTP()
      return XMLHTTP
    } catch(e){}
    try {
        MSXML2()
        return MSXML2
    } catch(e){}
    try {
        MSXML()
        return MSXML
    } catch(e){}

    return null

})()

var encodeJSON = function(object){
    if (object == null) return ""
    if (object.toJSON) return object.toJSON()
    return JSON.stringify(object)
}

// MooTools

var encodeQueryString = function(object, base){

    if (object == null) return ""
    if (object.toQueryString) return object.toQueryString()

    var queryString = []

    forIn(object, function(value, key){
        if (base) key = base + "[" + key + "]"
        var result

        if (value == null) return

        if (isArray(value)){
            var qs = {}
            for (var i = 0; i < value.length; i++) qs[i] = value[i]
            result = encodeQueryString(qs, key)
        } else if (isObject(value)){
            result = encodeQueryString(value, key)
        } else {
            result = key + "=" + encodeURIComponent(value)
        }

        queryString.push(result)
    })

    return queryString.join("&")

}

var decodeJSON = JSON.parse

// decodeQueryString by Brian Donovan
// http://stackoverflow.com/users/549363/brian-donovan

var decodeQueryString = function(params){

    var pairs  = params.split('&'),
        result = {}

    for (var i = 0; i < pairs.length; i++){

        var pair      = pairs[i].split('='),
            key       = decodeURIComponent(pair[0]),
            value     = decodeURIComponent(pair[1]),
            isArray   = /\[\]$/.test(key),
            dictMatch = key.match(/^(.+)\[([^\]]+)\]$/)

        if (dictMatch){
            key = dictMatch[1]
            var subkey = dictMatch[2]

            result[key] = result[key] || {}
            result[key][subkey] = value
        } else if (isArray){
            key = key.substring(0, key.length - 2)
            result[key] = result[key] || []
            result[key].push(value)
        } else {
            result[key] = value
        }

    }

    return result

}

var encoders = {
    "application/json" : encodeJSON,
    "application/x-www-form-urlencoded" : encodeQueryString
}

var decoders = {
    "application/json": decodeJSON,
    "application/x-www-form-urlencoded": decodeQueryString
}

// parseHeader from superagent
// https://github.com/visionmedia/superagent
// MIT

var parseHeader = function(str){
    var lines = str.split(/\r?\n/), fields = {}

    lines.pop() // trailing CRLF

    for (var i = 0, l = lines.length; i < l; ++i){
        var line  = lines[i],
            index = line.indexOf(':'),
            field = capitalize(line.slice(0, index)),
            value = trim(line.slice(index + 1))

        fields[field] = value
    }

    return fields
}

var REQUESTS = 0, Q = [] // Queue stuff

var Request = prime({

    constructor: function Request(){
        this._header = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    },

    header: function(name, value){
        if (isObject(name)) for (var key in name) this.header(key, name[key])
        else if (!arguments.length) return this._header
        else if (arguments.length === 1) return this._header[capitalize(name)]
        else if (arguments.length === 2){
            if (value == null) delete this._header[capitalize(name)]
            else this._header[capitalize(name)] = value
        }
        return this
    },

    running: function(){
        return !!this._running
    },

    abort: function(){

        if (this._queued){
            remove(Q, this._queued)
            delete this._queued
        }

        if (this._xhr){
            this._xhr.abort()
            this._end()
        }

        return this
    },

    method: function(m){
        if (!arguments.length) return this._method
        this._method = m.toUpperCase()
        return this
    },

    data: function(d){
        if (!arguments.length) return this._data
        this._data = d
        return this
    },

    url: function(u){
        if (!arguments.length) return this._url
        this._url = u
        return this
    },

    user: function(u){
        if (!arguments.length) return this._user
        this._user = u
        return this
    },

    password: function(p){
        if (!arguments.length) return this._password
        this._password = p
        return this
    },

    _send: function(method, url, data, header, user, password, callback){
        var self = this

        if (REQUESTS === agent.MAX_REQUESTS) return Q.unshift(this._queued = function(){
            delete self._queued
            self._send(method, url, data, header, user, password, callback)
        })

        REQUESTS++

        var xhr = this._xhr = agent.getRequest()

        if (xhr.addEventListener) forEach(['progress', 'load', 'error' , 'abort', 'loadend'], function(method){
            xhr.addEventListener(method, function(event){
                self.emit(method, event)
            }, false)
        })

        xhr.open(method, url, true, user, password)
        if (user != null && "withCredentials" in xhr) xhr.withCredentials = true

        xhr.onreadystatechange = function(){
            if (xhr.readyState === 4){
                var status = xhr.status
                var response = new Response(xhr.responseText, status, parseHeader(xhr.getAllResponseHeaders()))
                var error = response.error ? new Error(method + " " + url + " " + status) : null
                self._end()
                callback(error, response)
            }
        }

        for (var field in header) xhr.setRequestHeader(field, header[field])
        xhr.send(data || null)
    },

    _end: function(){
        this._xhr.onreadystatechange = function(){}

        delete this._xhr
        delete this._running

        REQUESTS--

        var queued = Q.pop()
        if (queued) queued()
    },

    send: function(callback){
        if (this._running) this.abort()
        this._running = true

        if (!callback) callback = function(){}

        var method   = this._method || "POST",
            data     = this._data || null,
            url      = this._url,
            user     = this._user || null,
            password = this._password || null

        if (data && !isString(data)){
            var contentType = this._header['Content-Type'].split(/ *; */).shift(),
                encode      = encoders[contentType]
            if (encode) data = encode(data)
        }

        if (/GET|HEAD/.test(method) && data) url += (url.indexOf("?") > -1 ? "&" : "?") + data

        var header = mixIn({}, this._header);

        this._send(method, url, data, header, user, password, callback)

        return this

    }

})

Request.implement(new Emitter)

var Response = prime({

    constructor: function Response(text, status, header){

        this.text   = text
        this.status = status

        this.header = header

        // statuses from superagent
        // https://github.com/visionmedia/superagent
        // MIT

        var t = status / 100 | 0

        this.info        = t === 1
        this.ok          = t === 2
        this.clientError = t === 4
        this.serverError = t === 5
        this.error       = t === 4 || t === 5
        var length = '' + header['Content-Length']

        // sugar
        this.accepted      = status === 202
        this.noContent     = length === '0' || status === 204 || status === 1223
        this.badRequest    = status === 400
        this.unauthorized  = status === 401
        this.notAcceptable = status === 406
        this.notFound      = status === 404

        var contentType = header['Content-Type'] ? header['Content-Type'].split(/ *; */).shift() : '',
            decode

        if (!this.noContent) decode = decoders[contentType]

        this.body = decode ? decode(this.text) : this.text

    }

})

var methods  = "get|post|put|delete|head|patch|options",
    rMethods = new RegExp("^(" + methods + ")$", "i")

var agent = function(method, url, data, callback){
    var request = new Request()

    if (!arguments.length) return request

    if (!rMethods.test(method)){ // shift
        callback = data
        data     = url
        url      = method
        method   = "post"
    }

    if (isFunction(data)){
        callback = data
        data = null
    }

    request.method(method)

    if (url) request.url(url)
    if (data) request.data(data)
    if (callback) request.send(callback)

    return request
}

agent.encoder = function(ct, encode){
    if (arguments.length === 1) return encoders[ct]
    encoders[ct] = encode
    return agent
}

agent.decoder = function(ct, decode){
    if (arguments.length === 1) return decoders[ct]
    decoders[ct] = decode
    return agent
}

forEach(methods.split("|"), function(method){
    agent[method] = function(url, data, callback){
        return agent(method, url, data, callback)
    }
})

agent.MAX_REQUESTS = Infinity
agent.getRequest = getRequest
agent.Request  = Request
agent.Response = Response

module.exports = agent

},{"mout/array/forEach":72,"mout/array/remove":74,"mout/lang/isArray":76,"mout/lang/isFunction":77,"mout/lang/isObject":79,"mout/lang/isString":80,"mout/object/forIn":83,"mout/object/mixIn":86,"mout/string/trim":90,"mout/string/upperCase":91,"prime":95,"prime/emitter":94}],72:[function(require,module,exports){


    /**
     * Array forEach
     */
    function forEach(arr, callback, thisObj) {
        if (arr == null) {
            return;
        }
        var i = -1,
            len = arr.length;
        while (++i < len) {
            // we iterate over sparse items since there is no way to make it
            // work properly on IE 7-8. see #64
            if ( callback.call(thisObj, arr[i], i, arr) === false ) {
                break;
            }
        }
    }

    module.exports = forEach;



},{}],73:[function(require,module,exports){


    /**
     * Array.indexOf
     */
    function indexOf(arr, item, fromIndex) {
        fromIndex = fromIndex || 0;
        if (arr == null) {
            return -1;
        }

        var len = arr.length,
            i = fromIndex < 0 ? len + fromIndex : fromIndex;
        while (i < len) {
            // we iterate over sparse items since there is no way to make it
            // work properly on IE 7-8. see #64
            if (arr[i] === item) {
                return i;
            }

            i++;
        }

        return -1;
    }

    module.exports = indexOf;


},{}],74:[function(require,module,exports){
var indexOf = require('./indexOf');

    /**
     * Remove a single item from the array.
     * (it won't remove duplicates, just a single item)
     */
    function remove(arr, item){
        var idx = indexOf(arr, item);
        if (idx !== -1) arr.splice(idx, 1);
    }

    module.exports = remove;


},{"./indexOf":73}],75:[function(require,module,exports){
var mixIn = require('../object/mixIn');

    /**
     * Create Object using prototypal inheritance and setting custom properties.
     * - Mix between Douglas Crockford Prototypal Inheritance <http://javascript.crockford.com/prototypal.html> and the EcmaScript 5 `Object.create()` method.
     * @param {object} parent    Parent Object.
     * @param {object} [props] Object properties.
     * @return {object} Created object.
     */
    function createObject(parent, props){
        function F(){}
        F.prototype = parent;
        return mixIn(new F(), props);

    }
    module.exports = createObject;



},{"../object/mixIn":86}],76:[function(require,module,exports){
var isKind = require('./isKind');
    /**
     */
    var isArray = Array.isArray || function (val) {
        return isKind(val, 'Array');
    };
    module.exports = isArray;


},{"./isKind":78}],77:[function(require,module,exports){
var isKind = require('./isKind');
    /**
     */
    function isFunction(val) {
        return isKind(val, 'Function');
    }
    module.exports = isFunction;


},{"./isKind":78}],78:[function(require,module,exports){
var kindOf = require('./kindOf');
    /**
     * Check if value is from a specific "kind".
     */
    function isKind(val, kind){
        return kindOf(val) === kind;
    }
    module.exports = isKind;


},{"./kindOf":81}],79:[function(require,module,exports){
var isKind = require('./isKind');
    /**
     */
    function isObject(val) {
        return isKind(val, 'Object');
    }
    module.exports = isObject;


},{"./isKind":78}],80:[function(require,module,exports){
var isKind = require('./isKind');
    /**
     */
    function isString(val) {
        return isKind(val, 'String');
    }
    module.exports = isString;


},{"./isKind":78}],81:[function(require,module,exports){


    var _rKind = /^\[object (.*)\]$/,
        _toString = Object.prototype.toString,
        UNDEF;

    /**
     * Gets the "kind" of value. (e.g. "String", "Number", etc)
     */
    function kindOf(val) {
        if (val === null) {
            return 'Null';
        } else if (val === UNDEF) {
            return 'Undefined';
        } else {
            return _rKind.exec( _toString.call(val) )[1];
        }
    }
    module.exports = kindOf;


},{}],82:[function(require,module,exports){


    /**
     * Typecast a value to a String, using an empty string value for null or
     * undefined.
     */
    function toString(val){
        return val == null ? '' : val.toString();
    }

    module.exports = toString;



},{}],83:[function(require,module,exports){
var hasOwn = require('./hasOwn');

    var _hasDontEnumBug,
        _dontEnums;

    function checkDontEnum(){
        _dontEnums = [
                'toString',
                'toLocaleString',
                'valueOf',
                'hasOwnProperty',
                'isPrototypeOf',
                'propertyIsEnumerable',
                'constructor'
            ];

        _hasDontEnumBug = true;

        for (var key in {'toString': null}) {
            _hasDontEnumBug = false;
        }
    }

    /**
     * Similar to Array/forEach but works over object properties and fixes Don't
     * Enum bug on IE.
     * based on: http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
     */
    function forIn(obj, fn, thisObj){
        var key, i = 0;
        // no need to check if argument is a real object that way we can use
        // it for arrays, functions, date, etc.

        //post-pone check till needed
        if (_hasDontEnumBug == null) checkDontEnum();

        for (key in obj) {
            if (exec(fn, obj, key, thisObj) === false) {
                break;
            }
        }


        if (_hasDontEnumBug) {
            var ctor = obj.constructor,
                isProto = !!ctor && obj === ctor.prototype;

            while (key = _dontEnums[i++]) {
                // For constructor, if it is a prototype object the constructor
                // is always non-enumerable unless defined otherwise (and
                // enumerated above).  For non-prototype objects, it will have
                // to be defined on this object, since it cannot be defined on
                // any prototype objects.
                //
                // For other [[DontEnum]] properties, check if the value is
                // different than Object prototype value.
                if (
                    (key !== 'constructor' ||
                        (!isProto && hasOwn(obj, key))) &&
                    obj[key] !== Object.prototype[key]
                ) {
                    if (exec(fn, obj, key, thisObj) === false) {
                        break;
                    }
                }
            }
        }
    }

    function exec(fn, obj, key, thisObj){
        return fn.call(thisObj, obj[key], key, obj);
    }

    module.exports = forIn;



},{"./hasOwn":85}],84:[function(require,module,exports){
var hasOwn = require('./hasOwn');
var forIn = require('./forIn');

    /**
     * Similar to Array/forEach but works over object properties and fixes Don't
     * Enum bug on IE.
     * based on: http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
     */
    function forOwn(obj, fn, thisObj){
        forIn(obj, function(val, key){
            if (hasOwn(obj, key)) {
                return fn.call(thisObj, obj[key], key, obj);
            }
        });
    }

    module.exports = forOwn;



},{"./forIn":83,"./hasOwn":85}],85:[function(require,module,exports){


    /**
     * Safer Object.hasOwnProperty
     */
     function hasOwn(obj, prop){
         return Object.prototype.hasOwnProperty.call(obj, prop);
     }

     module.exports = hasOwn;



},{}],86:[function(require,module,exports){
var forOwn = require('./forOwn');

    /**
    * Combine properties from all the objects into first one.
    * - This method affects target object in place, if you want to create a new Object pass an empty object as first param.
    * @param {object} target    Target Object
    * @param {...object} objects    Objects to be combined (0...n objects).
    * @return {object} Target Object.
    */
    function mixIn(target, objects){
        var i = 0,
            n = arguments.length,
            obj;
        while(++i < n){
            obj = arguments[i];
            if (obj != null) {
                forOwn(obj, copyProp, target);
            }
        }
        return target;
    }

    function copyProp(val, key){
        this[key] = val;
    }

    module.exports = mixIn;


},{"./forOwn":84}],87:[function(require,module,exports){

    /**
     * Contains all Unicode white-spaces. Taken from
     * http://en.wikipedia.org/wiki/Whitespace_character.
     */
    module.exports = [
        ' ', '\n', '\r', '\t', '\f', '\v', '\u00A0', '\u1680', '\u180E',
        '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006',
        '\u2007', '\u2008', '\u2009', '\u200A', '\u2028', '\u2029', '\u202F',
        '\u205F', '\u3000'
    ];


},{}],88:[function(require,module,exports){
var toString = require('../lang/toString');
var WHITE_SPACES = require('./WHITE_SPACES');
    /**
     * Remove chars from beginning of string.
     */
    function ltrim(str, chars) {
        str = toString(str);
        chars = chars || WHITE_SPACES;

        var start = 0,
            len = str.length,
            charLen = chars.length,
            found = true,
            i, c;

        while (found && start < len) {
            found = false;
            i = -1;
            c = str.charAt(start);

            while (++i < charLen) {
                if (c === chars[i]) {
                    found = true;
                    start++;
                    break;
                }
            }
        }

        return (start >= len) ? '' : str.substr(start, len);
    }

    module.exports = ltrim;


},{"../lang/toString":82,"./WHITE_SPACES":87}],89:[function(require,module,exports){
var toString = require('../lang/toString');
var WHITE_SPACES = require('./WHITE_SPACES');
    /**
     * Remove chars from end of string.
     */
    function rtrim(str, chars) {
        str = toString(str);
        chars = chars || WHITE_SPACES;

        var end = str.length - 1,
            charLen = chars.length,
            found = true,
            i, c;

        while (found && end >= 0) {
            found = false;
            i = -1;
            c = str.charAt(end);

            while (++i < charLen) {
                if (c === chars[i]) {
                    found = true;
                    end--;
                    break;
                }
            }
        }

        return (end >= 0) ? str.substring(0, end + 1) : '';
    }

    module.exports = rtrim;


},{"../lang/toString":82,"./WHITE_SPACES":87}],90:[function(require,module,exports){
var toString = require('../lang/toString');
var WHITE_SPACES = require('./WHITE_SPACES');
var ltrim = require('./ltrim');
var rtrim = require('./rtrim');
    /**
     * Remove white-spaces from beginning and end of string.
     */
    function trim(str, chars) {
        str = toString(str);
        chars = chars || WHITE_SPACES;
        return ltrim(rtrim(str, chars), chars);
    }

    module.exports = trim;


},{"../lang/toString":82,"./WHITE_SPACES":87,"./ltrim":88,"./rtrim":89}],91:[function(require,module,exports){
var toString = require('../lang/toString');
    /**
     * "Safer" String.toUpperCase()
     */
    function upperCase(str){
        str = toString(str);
        return str.toUpperCase();
    }
    module.exports = upperCase;


},{"../lang/toString":82}],92:[function(require,module,exports){


    /**
     * Get current time in miliseconds
     */
    function now(){
        // yes, we defer the work to another function to allow mocking it
        // during the tests
        return now.get();
    }

    now.get = (typeof Date.now === 'function')? Date.now : function(){
        return +(new Date());
    };

    module.exports = now;



},{}],93:[function(require,module,exports){
(function (process,global){
/*
defer
*/"use strict"

var kindOf  = require("mout/lang/kindOf"),
    now     = require("mout/time/now"),
    forEach = require("mout/array/forEach"),
    indexOf = require("mout/array/indexOf")

var callbacks = {
    timeout: {},
    frame: [],
    immediate: []
}

var push = function(collection, callback, context, defer){

    var iterator = function(){
        iterate(collection)
    }

    if (!collection.length) defer(iterator)

    var entry = {
        callback: callback,
        context: context
    }

    collection.push(entry)

    return function(){
        var io = indexOf(collection, entry)
        if (io > -1) collection.splice(io, 1)
    }
}

var iterate = function(collection){
    var time = now()

    forEach(collection.splice(0), function(entry) {
        entry.callback.call(entry.context, time)
    })
}

var defer = function(callback, argument, context){
    return (kindOf(argument) === "Number") ? defer.timeout(callback, argument, context) : defer.immediate(callback, argument)
}

if (global.process && process.nextTick){

    defer.immediate = function(callback, context){
        return push(callbacks.immediate, callback, context, process.nextTick)
    }

} else if (global.setImmediate){

    defer.immediate = function(callback, context){
        return push(callbacks.immediate, callback, context, setImmediate)
    }

} else if (global.postMessage && global.addEventListener){

    addEventListener("message", function(event){
        if (event.source === global && event.data === "@deferred"){
            event.stopPropagation()
            iterate(callbacks.immediate)
        }
    }, true)

    defer.immediate = function(callback, context){
        return push(callbacks.immediate, callback, context, function(){
            postMessage("@deferred", "*")
        })
    }

} else {

    defer.immediate = function(callback, context){
        return push(callbacks.immediate, callback, context, function(iterator){
            setTimeout(iterator, 0)
        })
    }

}

var requestAnimationFrame = global.requestAnimationFrame ||
    global.webkitRequestAnimationFrame ||
    global.mozRequestAnimationFrame ||
    global.oRequestAnimationFrame ||
    global.msRequestAnimationFrame ||
    function(callback) {
        setTimeout(callback, 1e3 / 60)
    }

defer.frame = function(callback, context){
    return push(callbacks.frame, callback, context, requestAnimationFrame)
}

var clear

defer.timeout = function(callback, ms, context){
    var ct = callbacks.timeout

    if (!clear) clear = defer.immediate(function(){
        clear = null
        callbacks.timeout = {}
    })

    return push(ct[ms] || (ct[ms] = []), callback, context, function(iterator){
        setTimeout(iterator, ms)
    })
}

module.exports = defer

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":1,"mout/array/forEach":72,"mout/array/indexOf":73,"mout/lang/kindOf":81,"mout/time/now":92}],94:[function(require,module,exports){
/*
Emitter
*/"use strict"

var indexOf = require("mout/array/indexOf"),
    forEach = require("mout/array/forEach")

var prime = require("./index"),
    defer = require("./defer")

var slice = Array.prototype.slice;

var Emitter = prime({

    on: function(event, fn){
        var listeners = this._listeners || (this._listeners = {}),
            events = listeners[event] || (listeners[event] = [])

        if (indexOf(events, fn) === -1) events.push(fn)

        return this
    },

    off: function(event, fn){
        var listeners = this._listeners, events, key, length = 0
        if (listeners && (events = listeners[event])){

            var io = indexOf(events, fn)
            if (io > -1) events.splice(io, 1)
            if (!events.length) delete listeners[event];
            for (var l in listeners) return this
            delete this._listeners
        }
        return this
    },

    emit: function(event){
        var self = this,
            args = slice.call(arguments, 1)

        var emit = function(){
            var listeners = self._listeners, events
            if (listeners && (events = listeners[event])){
                forEach(events.slice(0), function(event){
                    return event.apply(self, args)
                })
            }
        }

        if (args[args.length - 1] === Emitter.EMIT_SYNC){
            args.pop()
            emit()
        } else {
            defer(emit)
        }

        return this
    }

})

Emitter.EMIT_SYNC = {}

module.exports = Emitter

},{"./defer":93,"./index":95,"mout/array/forEach":72,"mout/array/indexOf":73}],95:[function(require,module,exports){
/*
prime
 - prototypal inheritance
*/"use strict"

var hasOwn = require("mout/object/hasOwn"),
    mixIn  = require("mout/object/mixIn"),
    create = require("mout/lang/createObject"),
    kindOf = require("mout/lang/kindOf")

var hasDescriptors = true

try {
    Object.defineProperty({}, "~", {})
    Object.getOwnPropertyDescriptor({}, "~")
} catch (e){
    hasDescriptors = false
}

// we only need to be able to implement "toString" and "valueOf" in IE < 9
var hasEnumBug = !({valueOf: 0}).propertyIsEnumerable("valueOf"),
    buggy      = ["toString", "valueOf"]

var verbs = /^constructor|inherits|mixin$/

var implement = function(proto){
    var prototype = this.prototype

    for (var key in proto){
        if (key.match(verbs)) continue
        if (hasDescriptors){
            var descriptor = Object.getOwnPropertyDescriptor(proto, key)
            if (descriptor){
                Object.defineProperty(prototype, key, descriptor)
                continue
            }
        }
        prototype[key] = proto[key]
    }

    if (hasEnumBug) for (var i = 0; (key = buggy[i]); i++){
        var value = proto[key]
        if (value !== Object.prototype[key]) prototype[key] = value
    }

    return this
}

var prime = function(proto){

    if (kindOf(proto) === "Function") proto = {constructor: proto}

    var superprime = proto.inherits

    // if our nice proto object has no own constructor property
    // then we proceed using a ghosting constructor that all it does is
    // call the parent's constructor if it has a superprime, else an empty constructor
    // proto.constructor becomes the effective constructor
    var constructor = (hasOwn(proto, "constructor")) ? proto.constructor : (superprime) ? function(){
        return superprime.apply(this, arguments)
    } : function(){}

    if (superprime){

        mixIn(constructor, superprime)

        var superproto = superprime.prototype
        // inherit from superprime
        var cproto = constructor.prototype = create(superproto)

        // setting constructor.parent to superprime.prototype
        // because it's the shortest possible absolute reference
        constructor.parent = superproto
        cproto.constructor = constructor
    }

    if (!constructor.implement) constructor.implement = implement

    var mixins = proto.mixin
    if (mixins){
        if (kindOf(mixins) !== "Array") mixins = [mixins]
        for (var i = 0; i < mixins.length; i++) constructor.implement(create(mixins[i].prototype))
    }

    // implement proto and return constructor
    return constructor.implement(proto)

}

module.exports = prime

},{"mout/lang/createObject":75,"mout/lang/kindOf":81,"mout/object/hasOwn":85,"mout/object/mixIn":86}],96:[function(require,module,exports){

module.exports = function(x1, y1, x2, y2, epsilon){

	var curveX = function(t){
		var v = 1 - t;
		return 3 * v * v * t * x1 + 3 * v * t * t * x2 + t * t * t;
	};

	var curveY = function(t){
		var v = 1 - t;
		return 3 * v * v * t * y1 + 3 * v * t * t * y2 + t * t * t;
	};

	var derivativeCurveX = function(t){
		var v = 1 - t;
		return 3 * (2 * (t - 1) * t + v * v) * x1 + 3 * (- t * t * t + 2 * v * t) * x2;
	};

	return function(t){

		var x = t, t0, t1, t2, x2, d2, i;

		// First try a few iterations of Newton's method -- normally very fast.
		for (t2 = x, i = 0; i < 8; i++){
			x2 = curveX(t2) - x;
			if (Math.abs(x2) < epsilon) return curveY(t2);
			d2 = derivativeCurveX(t2);
			if (Math.abs(d2) < 1e-6) break;
			t2 = t2 - x2 / d2;
		}

		t0 = 0, t1 = 1, t2 = x;

		if (t2 < t0) return curveY(t0);
		if (t2 > t1) return curveY(t1);

		// Fallback to the bisection method for reliability.
		while (t0 < t1){
			x2 = curveX(t2);
			if (Math.abs(x2 - x) < epsilon) return curveY(t2);
			if (x > x2) t0 = t2;
			else t1 = t2;
			t2 = (t1 - t0) * .5 + t0;
		}

		// Failure
		return curveY(t2);

	};

};

},{}],97:[function(require,module,exports){

/*
 *
 * More info at [www.dropzonejs.com](http://www.dropzonejs.com)
 *
 * Copyright (c) 2012, Matias Meno
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

(function() {
  var Dropzone, Emitter, camelize, contentLoaded, detectVerticalSquash, drawImageIOSFix, noop, without,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  noop = function() {};

  Emitter = (function() {
    function Emitter() {}

    Emitter.prototype.addEventListener = Emitter.prototype.on;

    Emitter.prototype.on = function(event, fn) {
      this._callbacks = this._callbacks || {};
      if (!this._callbacks[event]) {
        this._callbacks[event] = [];
      }
      this._callbacks[event].push(fn);
      return this;
    };

    Emitter.prototype.emit = function() {
      var args, callback, callbacks, event, _i, _len;
      event = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      this._callbacks = this._callbacks || {};
      callbacks = this._callbacks[event];
      if (callbacks) {
        for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
          callback = callbacks[_i];
          callback.apply(this, args);
        }
      }
      return this;
    };

    Emitter.prototype.removeListener = Emitter.prototype.off;

    Emitter.prototype.removeAllListeners = Emitter.prototype.off;

    Emitter.prototype.removeEventListener = Emitter.prototype.off;

    Emitter.prototype.off = function(event, fn) {
      var callback, callbacks, i, _i, _len;
      if (!this._callbacks || arguments.length === 0) {
        this._callbacks = {};
        return this;
      }
      callbacks = this._callbacks[event];
      if (!callbacks) {
        return this;
      }
      if (arguments.length === 1) {
        delete this._callbacks[event];
        return this;
      }
      for (i = _i = 0, _len = callbacks.length; _i < _len; i = ++_i) {
        callback = callbacks[i];
        if (callback === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }
      return this;
    };

    return Emitter;

  })();

  Dropzone = (function(_super) {
    var extend, resolveOption;

    __extends(Dropzone, _super);

    Dropzone.prototype.Emitter = Emitter;


    /*
    This is a list of all available events you can register on a dropzone object.
    
    You can register an event handler like this:
    
        dropzone.on("dragEnter", function() { });
     */

    Dropzone.prototype.events = ["drop", "dragstart", "dragend", "dragenter", "dragover", "dragleave", "addedfile", "addedfiles", "removedfile", "thumbnail", "error", "errormultiple", "processing", "processingmultiple", "uploadprogress", "totaluploadprogress", "sending", "sendingmultiple", "success", "successmultiple", "canceled", "canceledmultiple", "complete", "completemultiple", "reset", "maxfilesexceeded", "maxfilesreached", "queuecomplete"];

    Dropzone.prototype.defaultOptions = {
      url: null,
      method: "post",
      withCredentials: false,
      parallelUploads: 2,
      uploadMultiple: false,
      maxFilesize: 256,
      paramName: "file",
      createImageThumbnails: true,
      maxThumbnailFilesize: 10,
      thumbnailWidth: 120,
      thumbnailHeight: 120,
      filesizeBase: 1000,
      maxFiles: null,
      params: {},
      clickable: true,
      ignoreHiddenFiles: true,
      acceptedFiles: null,
      acceptedMimeTypes: null,
      autoProcessQueue: true,
      autoQueue: true,
      addRemoveLinks: false,
      previewsContainer: null,
      hiddenInputContainer: "body",
      capture: null,
      dictDefaultMessage: "Drop files here to upload",
      dictFallbackMessage: "Your browser does not support drag'n'drop file uploads.",
      dictFallbackText: "Please use the fallback form below to upload your files like in the olden days.",
      dictFileTooBig: "File is too big ({{filesize}}MiB). Max filesize: {{maxFilesize}}MiB.",
      dictInvalidFileType: "You can't upload files of this type.",
      dictResponseError: "Server responded with {{statusCode}} code.",
      dictCancelUpload: "Cancel upload",
      dictCancelUploadConfirmation: "Are you sure you want to cancel this upload?",
      dictRemoveFile: "Remove file",
      dictRemoveFileConfirmation: null,
      dictMaxFilesExceeded: "You can not upload any more files.",
      accept: function(file, done) {
        return done();
      },
      init: function() {
        return noop;
      },
      forceFallback: false,
      fallback: function() {
        var child, messageElement, span, _i, _len, _ref;
        this.element.className = "" + this.element.className + " dz-browser-not-supported";
        _ref = this.element.getElementsByTagName("div");
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (/(^| )dz-message($| )/.test(child.className)) {
            messageElement = child;
            child.className = "dz-message";
            continue;
          }
        }
        if (!messageElement) {
          messageElement = Dropzone.createElement("<div class=\"dz-message\"><span></span></div>");
          this.element.appendChild(messageElement);
        }
        span = messageElement.getElementsByTagName("span")[0];
        if (span) {
          if (span.textContent != null) {
            span.textContent = this.options.dictFallbackMessage;
          } else if (span.innerText != null) {
            span.innerText = this.options.dictFallbackMessage;
          }
        }
        return this.element.appendChild(this.getFallbackForm());
      },
      resize: function(file) {
        var info, srcRatio, trgRatio;
        info = {
          srcX: 0,
          srcY: 0,
          srcWidth: file.width,
          srcHeight: file.height
        };
        srcRatio = file.width / file.height;
        info.optWidth = this.options.thumbnailWidth;
        info.optHeight = this.options.thumbnailHeight;
        if ((info.optWidth == null) && (info.optHeight == null)) {
          info.optWidth = info.srcWidth;
          info.optHeight = info.srcHeight;
        } else if (info.optWidth == null) {
          info.optWidth = srcRatio * info.optHeight;
        } else if (info.optHeight == null) {
          info.optHeight = (1 / srcRatio) * info.optWidth;
        }
        trgRatio = info.optWidth / info.optHeight;
        if (file.height < info.optHeight || file.width < info.optWidth) {
          info.trgHeight = info.srcHeight;
          info.trgWidth = info.srcWidth;
        } else {
          if (srcRatio > trgRatio) {
            info.srcHeight = file.height;
            info.srcWidth = info.srcHeight * trgRatio;
          } else {
            info.srcWidth = file.width;
            info.srcHeight = info.srcWidth / trgRatio;
          }
        }
        info.srcX = (file.width - info.srcWidth) / 2;
        info.srcY = (file.height - info.srcHeight) / 2;
        return info;
      },

      /*
      Those functions register themselves to the events on init and handle all
      the user interface specific stuff. Overwriting them won't break the upload
      but can break the way it's displayed.
      You can overwrite them if you don't like the default behavior. If you just
      want to add an additional event handler, register it on the dropzone object
      and don't overwrite those options.
       */
      drop: function(e) {
        return this.element.classList.remove("dz-drag-hover");
      },
      dragstart: noop,
      dragend: function(e) {
        return this.element.classList.remove("dz-drag-hover");
      },
      dragenter: function(e) {
        return this.element.classList.add("dz-drag-hover");
      },
      dragover: function(e) {
        return this.element.classList.add("dz-drag-hover");
      },
      dragleave: function(e) {
        return this.element.classList.remove("dz-drag-hover");
      },
      paste: noop,
      reset: function() {
        return this.element.classList.remove("dz-started");
      },
      addedfile: function(file) {
        var node, removeFileEvent, removeLink, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _results;
        if (this.element === this.previewsContainer) {
          this.element.classList.add("dz-started");
        }
        if (this.previewsContainer) {
          file.previewElement = Dropzone.createElement(this.options.previewTemplate.trim());
          file.previewTemplate = file.previewElement;
          this.previewsContainer.appendChild(file.previewElement);
          _ref = file.previewElement.querySelectorAll("[data-dz-name]");
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            node = _ref[_i];
            node.textContent = file.name;
          }
          _ref1 = file.previewElement.querySelectorAll("[data-dz-size]");
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            node = _ref1[_j];
            node.innerHTML = this.filesize(file.size);
          }
          if (this.options.addRemoveLinks) {
            file._removeLink = Dropzone.createElement("<a class=\"dz-remove\" href=\"javascript:undefined;\" data-dz-remove>" + this.options.dictRemoveFile + "</a>");
            file.previewElement.appendChild(file._removeLink);
          }
          removeFileEvent = (function(_this) {
            return function(e) {
              e.preventDefault();
              e.stopPropagation();
              if (file.status === Dropzone.UPLOADING) {
                return Dropzone.confirm(_this.options.dictCancelUploadConfirmation, function() {
                  return _this.removeFile(file);
                });
              } else {
                if (_this.options.dictRemoveFileConfirmation) {
                  return Dropzone.confirm(_this.options.dictRemoveFileConfirmation, function() {
                    return _this.removeFile(file);
                  });
                } else {
                  return _this.removeFile(file);
                }
              }
            };
          })(this);
          _ref2 = file.previewElement.querySelectorAll("[data-dz-remove]");
          _results = [];
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            removeLink = _ref2[_k];
            _results.push(removeLink.addEventListener("click", removeFileEvent));
          }
          return _results;
        }
      },
      removedfile: function(file) {
        var _ref;
        if (file.previewElement) {
          if ((_ref = file.previewElement) != null) {
            _ref.parentNode.removeChild(file.previewElement);
          }
        }
        return this._updateMaxFilesReachedClass();
      },
      thumbnail: function(file, dataUrl) {
        var thumbnailElement, _i, _len, _ref;
        if (file.previewElement) {
          file.previewElement.classList.remove("dz-file-preview");
          _ref = file.previewElement.querySelectorAll("[data-dz-thumbnail]");
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            thumbnailElement = _ref[_i];
            thumbnailElement.alt = file.name;
            thumbnailElement.src = dataUrl;
          }
          return setTimeout(((function(_this) {
            return function() {
              return file.previewElement.classList.add("dz-image-preview");
            };
          })(this)), 1);
        }
      },
      error: function(file, message) {
        var node, _i, _len, _ref, _results;
        if (file.previewElement) {
          file.previewElement.classList.add("dz-error");
          if (typeof message !== "String" && message.error) {
            message = message.error;
          }
          _ref = file.previewElement.querySelectorAll("[data-dz-errormessage]");
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            node = _ref[_i];
            _results.push(node.textContent = message);
          }
          return _results;
        }
      },
      errormultiple: noop,
      processing: function(file) {
        if (file.previewElement) {
          file.previewElement.classList.add("dz-processing");
          if (file._removeLink) {
            return file._removeLink.textContent = this.options.dictCancelUpload;
          }
        }
      },
      processingmultiple: noop,
      uploadprogress: function(file, progress, bytesSent) {
        var node, _i, _len, _ref, _results;
        if (file.previewElement) {
          _ref = file.previewElement.querySelectorAll("[data-dz-uploadprogress]");
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            node = _ref[_i];
            if (node.nodeName === 'PROGRESS') {
              _results.push(node.value = progress);
            } else {
              _results.push(node.style.width = "" + progress + "%");
            }
          }
          return _results;
        }
      },
      totaluploadprogress: noop,
      sending: noop,
      sendingmultiple: noop,
      success: function(file) {
        if (file.previewElement) {
          return file.previewElement.classList.add("dz-success");
        }
      },
      successmultiple: noop,
      canceled: function(file) {
        return this.emit("error", file, "Upload canceled.");
      },
      canceledmultiple: noop,
      complete: function(file) {
        if (file._removeLink) {
          file._removeLink.textContent = this.options.dictRemoveFile;
        }
        if (file.previewElement) {
          return file.previewElement.classList.add("dz-complete");
        }
      },
      completemultiple: noop,
      maxfilesexceeded: noop,
      maxfilesreached: noop,
      queuecomplete: noop,
      addedfiles: noop,
      previewTemplate: "<div class=\"dz-preview dz-file-preview\">\n  <div class=\"dz-image\"><img data-dz-thumbnail /></div>\n  <div class=\"dz-details\">\n    <div class=\"dz-size\"><span data-dz-size></span></div>\n    <div class=\"dz-filename\"><span data-dz-name></span></div>\n  </div>\n  <div class=\"dz-progress\"><span class=\"dz-upload\" data-dz-uploadprogress></span></div>\n  <div class=\"dz-error-message\"><span data-dz-errormessage></span></div>\n  <div class=\"dz-success-mark\">\n    <svg width=\"54px\" height=\"54px\" viewBox=\"0 0 54 54\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:sketch=\"http://www.bohemiancoding.com/sketch/ns\">\n      <title>Check</title>\n      <defs></defs>\n      <g id=\"Page-1\" stroke=\"none\" stroke-width=\"1\" fill=\"none\" fill-rule=\"evenodd\" sketch:type=\"MSPage\">\n        <path d=\"M23.5,31.8431458 L17.5852419,25.9283877 C16.0248253,24.3679711 13.4910294,24.366835 11.9289322,25.9289322 C10.3700136,27.4878508 10.3665912,30.0234455 11.9283877,31.5852419 L20.4147581,40.0716123 C20.5133999,40.1702541 20.6159315,40.2626649 20.7218615,40.3488435 C22.2835669,41.8725651 24.794234,41.8626202 26.3461564,40.3106978 L43.3106978,23.3461564 C44.8771021,21.7797521 44.8758057,19.2483887 43.3137085,17.6862915 C41.7547899,16.1273729 39.2176035,16.1255422 37.6538436,17.6893022 L23.5,31.8431458 Z M27,53 C41.3594035,53 53,41.3594035 53,27 C53,12.6405965 41.3594035,1 27,1 C12.6405965,1 1,12.6405965 1,27 C1,41.3594035 12.6405965,53 27,53 Z\" id=\"Oval-2\" stroke-opacity=\"0.198794158\" stroke=\"#747474\" fill-opacity=\"0.816519475\" fill=\"#FFFFFF\" sketch:type=\"MSShapeGroup\"></path>\n      </g>\n    </svg>\n  </div>\n  <div class=\"dz-error-mark\">\n    <svg width=\"54px\" height=\"54px\" viewBox=\"0 0 54 54\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:sketch=\"http://www.bohemiancoding.com/sketch/ns\">\n      <title>Error</title>\n      <defs></defs>\n      <g id=\"Page-1\" stroke=\"none\" stroke-width=\"1\" fill=\"none\" fill-rule=\"evenodd\" sketch:type=\"MSPage\">\n        <g id=\"Check-+-Oval-2\" sketch:type=\"MSLayerGroup\" stroke=\"#747474\" stroke-opacity=\"0.198794158\" fill=\"#FFFFFF\" fill-opacity=\"0.816519475\">\n          <path d=\"M32.6568542,29 L38.3106978,23.3461564 C39.8771021,21.7797521 39.8758057,19.2483887 38.3137085,17.6862915 C36.7547899,16.1273729 34.2176035,16.1255422 32.6538436,17.6893022 L27,23.3431458 L21.3461564,17.6893022 C19.7823965,16.1255422 17.2452101,16.1273729 15.6862915,17.6862915 C14.1241943,19.2483887 14.1228979,21.7797521 15.6893022,23.3461564 L21.3431458,29 L15.6893022,34.6538436 C14.1228979,36.2202479 14.1241943,38.7516113 15.6862915,40.3137085 C17.2452101,41.8726271 19.7823965,41.8744578 21.3461564,40.3106978 L27,34.6568542 L32.6538436,40.3106978 C34.2176035,41.8744578 36.7547899,41.8726271 38.3137085,40.3137085 C39.8758057,38.7516113 39.8771021,36.2202479 38.3106978,34.6538436 L32.6568542,29 Z M27,53 C41.3594035,53 53,41.3594035 53,27 C53,12.6405965 41.3594035,1 27,1 C12.6405965,1 1,12.6405965 1,27 C1,41.3594035 12.6405965,53 27,53 Z\" id=\"Oval-2\" sketch:type=\"MSShapeGroup\"></path>\n        </g>\n      </g>\n    </svg>\n  </div>\n</div>"
    };

    extend = function() {
      var key, object, objects, target, val, _i, _len;
      target = arguments[0], objects = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      for (_i = 0, _len = objects.length; _i < _len; _i++) {
        object = objects[_i];
        for (key in object) {
          val = object[key];
          target[key] = val;
        }
      }
      return target;
    };

    function Dropzone(element, options) {
      var elementOptions, fallback, _ref;
      this.element = element;
      this.version = Dropzone.version;
      this.defaultOptions.previewTemplate = this.defaultOptions.previewTemplate.replace(/\n*/g, "");
      this.clickableElements = [];
      this.listeners = [];
      this.files = [];
      if (typeof this.element === "string") {
        this.element = document.querySelector(this.element);
      }
      if (!(this.element && (this.element.nodeType != null))) {
        throw new Error("Invalid dropzone element.");
      }
      if (this.element.dropzone) {
        throw new Error("Dropzone already attached.");
      }
      Dropzone.instances.push(this);
      this.element.dropzone = this;
      elementOptions = (_ref = Dropzone.optionsForElement(this.element)) != null ? _ref : {};
      this.options = extend({}, this.defaultOptions, elementOptions, options != null ? options : {});
      if (this.options.forceFallback || !Dropzone.isBrowserSupported()) {
        return this.options.fallback.call(this);
      }
      if (this.options.url == null) {
        this.options.url = this.element.getAttribute("action");
      }
      if (!this.options.url) {
        throw new Error("No URL provided.");
      }
      if (this.options.acceptedFiles && this.options.acceptedMimeTypes) {
        throw new Error("You can't provide both 'acceptedFiles' and 'acceptedMimeTypes'. 'acceptedMimeTypes' is deprecated.");
      }
      if (this.options.acceptedMimeTypes) {
        this.options.acceptedFiles = this.options.acceptedMimeTypes;
        delete this.options.acceptedMimeTypes;
      }
      this.options.method = this.options.method.toUpperCase();
      if ((fallback = this.getExistingFallback()) && fallback.parentNode) {
        fallback.parentNode.removeChild(fallback);
      }
      if (this.options.previewsContainer !== false) {
        if (this.options.previewsContainer) {
          this.previewsContainer = Dropzone.getElement(this.options.previewsContainer, "previewsContainer");
        } else {
          this.previewsContainer = this.element;
        }
      }
      if (this.options.clickable) {
        if (this.options.clickable === true) {
          this.clickableElements = [this.element];
        } else {
          this.clickableElements = Dropzone.getElements(this.options.clickable, "clickable");
        }
      }
      this.init();
    }

    Dropzone.prototype.getAcceptedFiles = function() {
      var file, _i, _len, _ref, _results;
      _ref = this.files;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        if (file.accepted) {
          _results.push(file);
        }
      }
      return _results;
    };

    Dropzone.prototype.getRejectedFiles = function() {
      var file, _i, _len, _ref, _results;
      _ref = this.files;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        if (!file.accepted) {
          _results.push(file);
        }
      }
      return _results;
    };

    Dropzone.prototype.getFilesWithStatus = function(status) {
      var file, _i, _len, _ref, _results;
      _ref = this.files;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        if (file.status === status) {
          _results.push(file);
        }
      }
      return _results;
    };

    Dropzone.prototype.getQueuedFiles = function() {
      return this.getFilesWithStatus(Dropzone.QUEUED);
    };

    Dropzone.prototype.getUploadingFiles = function() {
      return this.getFilesWithStatus(Dropzone.UPLOADING);
    };

    Dropzone.prototype.getAddedFiles = function() {
      return this.getFilesWithStatus(Dropzone.ADDED);
    };

    Dropzone.prototype.getActiveFiles = function() {
      var file, _i, _len, _ref, _results;
      _ref = this.files;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        if (file.status === Dropzone.UPLOADING || file.status === Dropzone.QUEUED) {
          _results.push(file);
        }
      }
      return _results;
    };

    Dropzone.prototype.init = function() {
      var eventName, noPropagation, setupHiddenFileInput, _i, _len, _ref, _ref1;
      if (this.element.tagName === "form") {
        this.element.setAttribute("enctype", "multipart/form-data");
      }
      if (this.element.classList.contains("dropzone") && !this.element.querySelector(".dz-message")) {
        this.element.appendChild(Dropzone.createElement("<div class=\"dz-default dz-message\"><span>" + this.options.dictDefaultMessage + "</span></div>"));
      }
      if (this.clickableElements.length) {
        setupHiddenFileInput = (function(_this) {
          return function() {
            if (_this.hiddenFileInput) {
              _this.hiddenFileInput.parentNode.removeChild(_this.hiddenFileInput);
            }
            _this.hiddenFileInput = document.createElement("input");
            _this.hiddenFileInput.setAttribute("type", "file");
            if ((_this.options.maxFiles == null) || _this.options.maxFiles > 1) {
              _this.hiddenFileInput.setAttribute("multiple", "multiple");
            }
            _this.hiddenFileInput.className = "dz-hidden-input";
            if (_this.options.acceptedFiles != null) {
              _this.hiddenFileInput.setAttribute("accept", _this.options.acceptedFiles);
            }
            if (_this.options.capture != null) {
              _this.hiddenFileInput.setAttribute("capture", _this.options.capture);
            }
            _this.hiddenFileInput.style.visibility = "hidden";
            _this.hiddenFileInput.style.position = "absolute";
            _this.hiddenFileInput.style.top = "0";
            _this.hiddenFileInput.style.left = "0";
            _this.hiddenFileInput.style.height = "0";
            _this.hiddenFileInput.style.width = "0";
            document.querySelector(_this.options.hiddenInputContainer).appendChild(_this.hiddenFileInput);
            return _this.hiddenFileInput.addEventListener("change", function() {
              var file, files, _i, _len;
              files = _this.hiddenFileInput.files;
              if (files.length) {
                for (_i = 0, _len = files.length; _i < _len; _i++) {
                  file = files[_i];
                  _this.addFile(file);
                }
              }
              _this.emit("addedfiles", files);
              return setupHiddenFileInput();
            });
          };
        })(this);
        setupHiddenFileInput();
      }
      this.URL = (_ref = window.URL) != null ? _ref : window.webkitURL;
      _ref1 = this.events;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        eventName = _ref1[_i];
        this.on(eventName, this.options[eventName]);
      }
      this.on("uploadprogress", (function(_this) {
        return function() {
          return _this.updateTotalUploadProgress();
        };
      })(this));
      this.on("removedfile", (function(_this) {
        return function() {
          return _this.updateTotalUploadProgress();
        };
      })(this));
      this.on("canceled", (function(_this) {
        return function(file) {
          return _this.emit("complete", file);
        };
      })(this));
      this.on("complete", (function(_this) {
        return function(file) {
          if (_this.getAddedFiles().length === 0 && _this.getUploadingFiles().length === 0 && _this.getQueuedFiles().length === 0) {
            return setTimeout((function() {
              return _this.emit("queuecomplete");
            }), 0);
          }
        };
      })(this));
      noPropagation = function(e) {
        e.stopPropagation();
        if (e.preventDefault) {
          return e.preventDefault();
        } else {
          return e.returnValue = false;
        }
      };
      this.listeners = [
        {
          element: this.element,
          events: {
            "dragstart": (function(_this) {
              return function(e) {
                return _this.emit("dragstart", e);
              };
            })(this),
            "dragenter": (function(_this) {
              return function(e) {
                noPropagation(e);
                return _this.emit("dragenter", e);
              };
            })(this),
            "dragover": (function(_this) {
              return function(e) {
                var efct;
                try {
                  efct = e.dataTransfer.effectAllowed;
                } catch (_error) {}
                e.dataTransfer.dropEffect = 'move' === efct || 'linkMove' === efct ? 'move' : 'copy';
                noPropagation(e);
                return _this.emit("dragover", e);
              };
            })(this),
            "dragleave": (function(_this) {
              return function(e) {
                return _this.emit("dragleave", e);
              };
            })(this),
            "drop": (function(_this) {
              return function(e) {
                noPropagation(e);
                return _this.drop(e);
              };
            })(this),
            "dragend": (function(_this) {
              return function(e) {
                return _this.emit("dragend", e);
              };
            })(this)
          }
        }
      ];
      this.clickableElements.forEach((function(_this) {
        return function(clickableElement) {
          return _this.listeners.push({
            element: clickableElement,
            events: {
              "click": function(evt) {
                if ((clickableElement !== _this.element) || (evt.target === _this.element || Dropzone.elementInside(evt.target, _this.element.querySelector(".dz-message")))) {
                  _this.hiddenFileInput.click();
                }
                return true;
              }
            }
          });
        };
      })(this));
      this.enable();
      return this.options.init.call(this);
    };

    Dropzone.prototype.destroy = function() {
      var _ref;
      this.disable();
      this.removeAllFiles(true);
      if ((_ref = this.hiddenFileInput) != null ? _ref.parentNode : void 0) {
        this.hiddenFileInput.parentNode.removeChild(this.hiddenFileInput);
        this.hiddenFileInput = null;
      }
      delete this.element.dropzone;
      return Dropzone.instances.splice(Dropzone.instances.indexOf(this), 1);
    };

    Dropzone.prototype.updateTotalUploadProgress = function() {
      var activeFiles, file, totalBytes, totalBytesSent, totalUploadProgress, _i, _len, _ref;
      totalBytesSent = 0;
      totalBytes = 0;
      activeFiles = this.getActiveFiles();
      if (activeFiles.length) {
        _ref = this.getActiveFiles();
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          file = _ref[_i];
          totalBytesSent += file.upload.bytesSent;
          totalBytes += file.upload.total;
        }
        totalUploadProgress = 100 * totalBytesSent / totalBytes;
      } else {
        totalUploadProgress = 100;
      }
      return this.emit("totaluploadprogress", totalUploadProgress, totalBytes, totalBytesSent);
    };

    Dropzone.prototype._getParamName = function(n) {
      if (typeof this.options.paramName === "function") {
        return this.options.paramName(n);
      } else {
        return "" + this.options.paramName + (this.options.uploadMultiple ? "[" + n + "]" : "");
      }
    };

    Dropzone.prototype.getFallbackForm = function() {
      var existingFallback, fields, fieldsString, form;
      if (existingFallback = this.getExistingFallback()) {
        return existingFallback;
      }
      fieldsString = "<div class=\"dz-fallback\">";
      if (this.options.dictFallbackText) {
        fieldsString += "<p>" + this.options.dictFallbackText + "</p>";
      }
      fieldsString += "<input type=\"file\" name=\"" + (this._getParamName(0)) + "\" " + (this.options.uploadMultiple ? 'multiple="multiple"' : void 0) + " /><input type=\"submit\" value=\"Upload!\"></div>";
      fields = Dropzone.createElement(fieldsString);
      if (this.element.tagName !== "FORM") {
        form = Dropzone.createElement("<form action=\"" + this.options.url + "\" enctype=\"multipart/form-data\" method=\"" + this.options.method + "\"></form>");
        form.appendChild(fields);
      } else {
        this.element.setAttribute("enctype", "multipart/form-data");
        this.element.setAttribute("method", this.options.method);
      }
      return form != null ? form : fields;
    };

    Dropzone.prototype.getExistingFallback = function() {
      var fallback, getFallback, tagName, _i, _len, _ref;
      getFallback = function(elements) {
        var el, _i, _len;
        for (_i = 0, _len = elements.length; _i < _len; _i++) {
          el = elements[_i];
          if (/(^| )fallback($| )/.test(el.className)) {
            return el;
          }
        }
      };
      _ref = ["div", "form"];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        tagName = _ref[_i];
        if (fallback = getFallback(this.element.getElementsByTagName(tagName))) {
          return fallback;
        }
      }
    };

    Dropzone.prototype.setupEventListeners = function() {
      var elementListeners, event, listener, _i, _len, _ref, _results;
      _ref = this.listeners;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        elementListeners = _ref[_i];
        _results.push((function() {
          var _ref1, _results1;
          _ref1 = elementListeners.events;
          _results1 = [];
          for (event in _ref1) {
            listener = _ref1[event];
            _results1.push(elementListeners.element.addEventListener(event, listener, false));
          }
          return _results1;
        })());
      }
      return _results;
    };

    Dropzone.prototype.removeEventListeners = function() {
      var elementListeners, event, listener, _i, _len, _ref, _results;
      _ref = this.listeners;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        elementListeners = _ref[_i];
        _results.push((function() {
          var _ref1, _results1;
          _ref1 = elementListeners.events;
          _results1 = [];
          for (event in _ref1) {
            listener = _ref1[event];
            _results1.push(elementListeners.element.removeEventListener(event, listener, false));
          }
          return _results1;
        })());
      }
      return _results;
    };

    Dropzone.prototype.disable = function() {
      var file, _i, _len, _ref, _results;
      this.clickableElements.forEach(function(element) {
        return element.classList.remove("dz-clickable");
      });
      this.removeEventListeners();
      _ref = this.files;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        _results.push(this.cancelUpload(file));
      }
      return _results;
    };

    Dropzone.prototype.enable = function() {
      this.clickableElements.forEach(function(element) {
        return element.classList.add("dz-clickable");
      });
      return this.setupEventListeners();
    };

    Dropzone.prototype.filesize = function(size) {
      var cutoff, i, selectedSize, selectedUnit, unit, units, _i, _len;
      selectedSize = 0;
      selectedUnit = "b";
      if (size > 0) {
        units = ['TB', 'GB', 'MB', 'KB', 'b'];
        for (i = _i = 0, _len = units.length; _i < _len; i = ++_i) {
          unit = units[i];
          cutoff = Math.pow(this.options.filesizeBase, 4 - i) / 10;
          if (size >= cutoff) {
            selectedSize = size / Math.pow(this.options.filesizeBase, 4 - i);
            selectedUnit = unit;
            break;
          }
        }
        selectedSize = Math.round(10 * selectedSize) / 10;
      }
      return "<strong>" + selectedSize + "</strong> " + selectedUnit;
    };

    Dropzone.prototype._updateMaxFilesReachedClass = function() {
      if ((this.options.maxFiles != null) && this.getAcceptedFiles().length >= this.options.maxFiles) {
        if (this.getAcceptedFiles().length === this.options.maxFiles) {
          this.emit('maxfilesreached', this.files);
        }
        return this.element.classList.add("dz-max-files-reached");
      } else {
        return this.element.classList.remove("dz-max-files-reached");
      }
    };

    Dropzone.prototype.drop = function(e) {
      var files, items;
      if (!e.dataTransfer) {
        return;
      }
      this.emit("drop", e);
      files = e.dataTransfer.files;
      this.emit("addedfiles", files);
      if (files.length) {
        items = e.dataTransfer.items;
        if (items && items.length && (items[0].webkitGetAsEntry != null)) {
          this._addFilesFromItems(items);
        } else {
          this.handleFiles(files);
        }
      }
    };

    Dropzone.prototype.paste = function(e) {
      var items, _ref;
      if ((e != null ? (_ref = e.clipboardData) != null ? _ref.items : void 0 : void 0) == null) {
        return;
      }
      this.emit("paste", e);
      items = e.clipboardData.items;
      if (items.length) {
        return this._addFilesFromItems(items);
      }
    };

    Dropzone.prototype.handleFiles = function(files) {
      var file, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        _results.push(this.addFile(file));
      }
      return _results;
    };

    Dropzone.prototype._addFilesFromItems = function(items) {
      var entry, item, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = items.length; _i < _len; _i++) {
        item = items[_i];
        if ((item.webkitGetAsEntry != null) && (entry = item.webkitGetAsEntry())) {
          if (entry.isFile) {
            _results.push(this.addFile(item.getAsFile()));
          } else if (entry.isDirectory) {
            _results.push(this._addFilesFromDirectory(entry, entry.name));
          } else {
            _results.push(void 0);
          }
        } else if (item.getAsFile != null) {
          if ((item.kind == null) || item.kind === "file") {
            _results.push(this.addFile(item.getAsFile()));
          } else {
            _results.push(void 0);
          }
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Dropzone.prototype._addFilesFromDirectory = function(directory, path) {
      var dirReader, entriesReader;
      dirReader = directory.createReader();
      entriesReader = (function(_this) {
        return function(entries) {
          var entry, _i, _len;
          for (_i = 0, _len = entries.length; _i < _len; _i++) {
            entry = entries[_i];
            if (entry.isFile) {
              entry.file(function(file) {
                if (_this.options.ignoreHiddenFiles && file.name.substring(0, 1) === '.') {
                  return;
                }
                file.fullPath = "" + path + "/" + file.name;
                return _this.addFile(file);
              });
            } else if (entry.isDirectory) {
              _this._addFilesFromDirectory(entry, "" + path + "/" + entry.name);
            }
          }
        };
      })(this);
      return dirReader.readEntries(entriesReader, function(error) {
        return typeof console !== "undefined" && console !== null ? typeof console.log === "function" ? console.log(error) : void 0 : void 0;
      });
    };

    Dropzone.prototype.accept = function(file, done) {
      if (file.size > this.options.maxFilesize * 1024 * 1024) {
        return done(this.options.dictFileTooBig.replace("{{filesize}}", Math.round(file.size / 1024 / 10.24) / 100).replace("{{maxFilesize}}", this.options.maxFilesize));
      } else if (!Dropzone.isValidFile(file, this.options.acceptedFiles)) {
        return done(this.options.dictInvalidFileType);
      } else if ((this.options.maxFiles != null) && this.getAcceptedFiles().length >= this.options.maxFiles) {
        done(this.options.dictMaxFilesExceeded.replace("{{maxFiles}}", this.options.maxFiles));
        return this.emit("maxfilesexceeded", file);
      } else {
        return this.options.accept.call(this, file, done);
      }
    };

    Dropzone.prototype.addFile = function(file) {
      file.upload = {
        progress: 0,
        total: file.size,
        bytesSent: 0
      };
      this.files.push(file);
      file.status = Dropzone.ADDED;
      this.emit("addedfile", file);
      this._enqueueThumbnail(file);
      return this.accept(file, (function(_this) {
        return function(error) {
          if (error) {
            file.accepted = false;
            _this._errorProcessing([file], error);
          } else {
            file.accepted = true;
            if (_this.options.autoQueue) {
              _this.enqueueFile(file);
            }
          }
          return _this._updateMaxFilesReachedClass();
        };
      })(this));
    };

    Dropzone.prototype.enqueueFiles = function(files) {
      var file, _i, _len;
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        this.enqueueFile(file);
      }
      return null;
    };

    Dropzone.prototype.enqueueFile = function(file) {
      if (file.status === Dropzone.ADDED && file.accepted === true) {
        file.status = Dropzone.QUEUED;
        if (this.options.autoProcessQueue) {
          return setTimeout(((function(_this) {
            return function() {
              return _this.processQueue();
            };
          })(this)), 0);
        }
      } else {
        throw new Error("This file can't be queued because it has already been processed or was rejected.");
      }
    };

    Dropzone.prototype._thumbnailQueue = [];

    Dropzone.prototype._processingThumbnail = false;

    Dropzone.prototype._enqueueThumbnail = function(file) {
      if (this.options.createImageThumbnails && file.type.match(/image.*/) && file.size <= this.options.maxThumbnailFilesize * 1024 * 1024) {
        this._thumbnailQueue.push(file);
        return setTimeout(((function(_this) {
          return function() {
            return _this._processThumbnailQueue();
          };
        })(this)), 0);
      }
    };

    Dropzone.prototype._processThumbnailQueue = function() {
      if (this._processingThumbnail || this._thumbnailQueue.length === 0) {
        return;
      }
      this._processingThumbnail = true;
      return this.createThumbnail(this._thumbnailQueue.shift(), (function(_this) {
        return function() {
          _this._processingThumbnail = false;
          return _this._processThumbnailQueue();
        };
      })(this));
    };

    Dropzone.prototype.removeFile = function(file) {
      if (file.status === Dropzone.UPLOADING) {
        this.cancelUpload(file);
      }
      this.files = without(this.files, file);
      this.emit("removedfile", file);
      if (this.files.length === 0) {
        return this.emit("reset");
      }
    };

    Dropzone.prototype.removeAllFiles = function(cancelIfNecessary) {
      var file, _i, _len, _ref;
      if (cancelIfNecessary == null) {
        cancelIfNecessary = false;
      }
      _ref = this.files.slice();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        if (file.status !== Dropzone.UPLOADING || cancelIfNecessary) {
          this.removeFile(file);
        }
      }
      return null;
    };

    Dropzone.prototype.createThumbnail = function(file, callback) {
      var fileReader;
      fileReader = new FileReader;
      fileReader.onload = (function(_this) {
        return function() {
          if (file.type === "image/svg+xml") {
            _this.emit("thumbnail", file, fileReader.result);
            if (callback != null) {
              callback();
            }
            return;
          }
          return _this.createThumbnailFromUrl(file, fileReader.result, callback);
        };
      })(this);
      return fileReader.readAsDataURL(file);
    };

    Dropzone.prototype.createThumbnailFromUrl = function(file, imageUrl, callback, crossOrigin) {
      var img;
      img = document.createElement("img");
      if (crossOrigin) {
        img.crossOrigin = crossOrigin;
      }
      img.onload = (function(_this) {
        return function() {
          var canvas, ctx, resizeInfo, thumbnail, _ref, _ref1, _ref2, _ref3;
          file.width = img.width;
          file.height = img.height;
          resizeInfo = _this.options.resize.call(_this, file);
          if (resizeInfo.trgWidth == null) {
            resizeInfo.trgWidth = resizeInfo.optWidth;
          }
          if (resizeInfo.trgHeight == null) {
            resizeInfo.trgHeight = resizeInfo.optHeight;
          }
          canvas = document.createElement("canvas");
          ctx = canvas.getContext("2d");
          canvas.width = resizeInfo.trgWidth;
          canvas.height = resizeInfo.trgHeight;
          drawImageIOSFix(ctx, img, (_ref = resizeInfo.srcX) != null ? _ref : 0, (_ref1 = resizeInfo.srcY) != null ? _ref1 : 0, resizeInfo.srcWidth, resizeInfo.srcHeight, (_ref2 = resizeInfo.trgX) != null ? _ref2 : 0, (_ref3 = resizeInfo.trgY) != null ? _ref3 : 0, resizeInfo.trgWidth, resizeInfo.trgHeight);
          thumbnail = canvas.toDataURL("image/png");
          _this.emit("thumbnail", file, thumbnail);
          if (callback != null) {
            return callback();
          }
        };
      })(this);
      if (callback != null) {
        img.onerror = callback;
      }
      return img.src = imageUrl;
    };

    Dropzone.prototype.processQueue = function() {
      var i, parallelUploads, processingLength, queuedFiles;
      parallelUploads = this.options.parallelUploads;
      processingLength = this.getUploadingFiles().length;
      i = processingLength;
      if (processingLength >= parallelUploads) {
        return;
      }
      queuedFiles = this.getQueuedFiles();
      if (!(queuedFiles.length > 0)) {
        return;
      }
      if (this.options.uploadMultiple) {
        return this.processFiles(queuedFiles.slice(0, parallelUploads - processingLength));
      } else {
        while (i < parallelUploads) {
          if (!queuedFiles.length) {
            return;
          }
          this.processFile(queuedFiles.shift());
          i++;
        }
      }
    };

    Dropzone.prototype.processFile = function(file) {
      return this.processFiles([file]);
    };

    Dropzone.prototype.processFiles = function(files) {
      var file, _i, _len;
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        file.processing = true;
        file.status = Dropzone.UPLOADING;
        this.emit("processing", file);
      }
      if (this.options.uploadMultiple) {
        this.emit("processingmultiple", files);
      }
      return this.uploadFiles(files);
    };

    Dropzone.prototype._getFilesWithXhr = function(xhr) {
      var file, files;
      return files = (function() {
        var _i, _len, _ref, _results;
        _ref = this.files;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          file = _ref[_i];
          if (file.xhr === xhr) {
            _results.push(file);
          }
        }
        return _results;
      }).call(this);
    };

    Dropzone.prototype.cancelUpload = function(file) {
      var groupedFile, groupedFiles, _i, _j, _len, _len1, _ref;
      if (file.status === Dropzone.UPLOADING) {
        groupedFiles = this._getFilesWithXhr(file.xhr);
        for (_i = 0, _len = groupedFiles.length; _i < _len; _i++) {
          groupedFile = groupedFiles[_i];
          groupedFile.status = Dropzone.CANCELED;
        }
        file.xhr.abort();
        for (_j = 0, _len1 = groupedFiles.length; _j < _len1; _j++) {
          groupedFile = groupedFiles[_j];
          this.emit("canceled", groupedFile);
        }
        if (this.options.uploadMultiple) {
          this.emit("canceledmultiple", groupedFiles);
        }
      } else if ((_ref = file.status) === Dropzone.ADDED || _ref === Dropzone.QUEUED) {
        file.status = Dropzone.CANCELED;
        this.emit("canceled", file);
        if (this.options.uploadMultiple) {
          this.emit("canceledmultiple", [file]);
        }
      }
      if (this.options.autoProcessQueue) {
        return this.processQueue();
      }
    };

    resolveOption = function() {
      var args, option;
      option = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (typeof option === 'function') {
        return option.apply(this, args);
      }
      return option;
    };

    Dropzone.prototype.uploadFile = function(file) {
      return this.uploadFiles([file]);
    };

    Dropzone.prototype.uploadFiles = function(files) {
      var file, formData, handleError, headerName, headerValue, headers, i, input, inputName, inputType, key, method, option, progressObj, response, updateProgress, url, value, xhr, _i, _j, _k, _l, _len, _len1, _len2, _len3, _m, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
      xhr = new XMLHttpRequest();
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        file.xhr = xhr;
      }
      method = resolveOption(this.options.method, files);
      url = resolveOption(this.options.url, files);
      xhr.open(method, url, true);
      xhr.withCredentials = !!this.options.withCredentials;
      response = null;
      handleError = (function(_this) {
        return function() {
          var _j, _len1, _results;
          _results = [];
          for (_j = 0, _len1 = files.length; _j < _len1; _j++) {
            file = files[_j];
            _results.push(_this._errorProcessing(files, response || _this.options.dictResponseError.replace("{{statusCode}}", xhr.status), xhr));
          }
          return _results;
        };
      })(this);
      updateProgress = (function(_this) {
        return function(e) {
          var allFilesFinished, progress, _j, _k, _l, _len1, _len2, _len3, _results;
          if (e != null) {
            progress = 100 * e.loaded / e.total;
            for (_j = 0, _len1 = files.length; _j < _len1; _j++) {
              file = files[_j];
              file.upload = {
                progress: progress,
                total: e.total,
                bytesSent: e.loaded
              };
            }
          } else {
            allFilesFinished = true;
            progress = 100;
            for (_k = 0, _len2 = files.length; _k < _len2; _k++) {
              file = files[_k];
              if (!(file.upload.progress === 100 && file.upload.bytesSent === file.upload.total)) {
                allFilesFinished = false;
              }
              file.upload.progress = progress;
              file.upload.bytesSent = file.upload.total;
            }
            if (allFilesFinished) {
              return;
            }
          }
          _results = [];
          for (_l = 0, _len3 = files.length; _l < _len3; _l++) {
            file = files[_l];
            _results.push(_this.emit("uploadprogress", file, progress, file.upload.bytesSent));
          }
          return _results;
        };
      })(this);
      xhr.onload = (function(_this) {
        return function(e) {
          var _ref;
          if (files[0].status === Dropzone.CANCELED) {
            return;
          }
          if (xhr.readyState !== 4) {
            return;
          }
          response = xhr.responseText;
          if (xhr.getResponseHeader("content-type") && ~xhr.getResponseHeader("content-type").indexOf("application/json")) {
            try {
              response = JSON.parse(response);
            } catch (_error) {
              e = _error;
              response = "Invalid JSON response from server.";
            }
          }
          updateProgress();
          if (!((200 <= (_ref = xhr.status) && _ref < 300))) {
            return handleError();
          } else {
            return _this._finished(files, response, e);
          }
        };
      })(this);
      xhr.onerror = (function(_this) {
        return function() {
          if (files[0].status === Dropzone.CANCELED) {
            return;
          }
          return handleError();
        };
      })(this);
      progressObj = (_ref = xhr.upload) != null ? _ref : xhr;
      progressObj.onprogress = updateProgress;
      headers = {
        "Accept": "application/json",
        "Cache-Control": "no-cache",
        "X-Requested-With": "XMLHttpRequest"
      };
      if (this.options.headers) {
        extend(headers, this.options.headers);
      }
      for (headerName in headers) {
        headerValue = headers[headerName];
        if (headerValue) {
          xhr.setRequestHeader(headerName, headerValue);
        }
      }
      formData = new FormData();
      if (this.options.params) {
        _ref1 = this.options.params;
        for (key in _ref1) {
          value = _ref1[key];
          formData.append(key, value);
        }
      }
      for (_j = 0, _len1 = files.length; _j < _len1; _j++) {
        file = files[_j];
        this.emit("sending", file, xhr, formData);
      }
      if (this.options.uploadMultiple) {
        this.emit("sendingmultiple", files, xhr, formData);
      }
      if (this.element.tagName === "FORM") {
        _ref2 = this.element.querySelectorAll("input, textarea, select, button");
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          input = _ref2[_k];
          inputName = input.getAttribute("name");
          inputType = input.getAttribute("type");
          if (input.tagName === "SELECT" && input.hasAttribute("multiple")) {
            _ref3 = input.options;
            for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
              option = _ref3[_l];
              if (option.selected) {
                formData.append(inputName, option.value);
              }
            }
          } else if (!inputType || ((_ref4 = inputType.toLowerCase()) !== "checkbox" && _ref4 !== "radio") || input.checked) {
            formData.append(inputName, input.value);
          }
        }
      }
      for (i = _m = 0, _ref5 = files.length - 1; 0 <= _ref5 ? _m <= _ref5 : _m >= _ref5; i = 0 <= _ref5 ? ++_m : --_m) {
        formData.append(this._getParamName(i), files[i], files[i].name);
      }
      return this.submitRequest(xhr, formData, files);
    };

    Dropzone.prototype.submitRequest = function(xhr, formData, files) {
      return xhr.send(formData);
    };

    Dropzone.prototype._finished = function(files, responseText, e) {
      var file, _i, _len;
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        file.status = Dropzone.SUCCESS;
        this.emit("success", file, responseText, e);
        this.emit("complete", file);
      }
      if (this.options.uploadMultiple) {
        this.emit("successmultiple", files, responseText, e);
        this.emit("completemultiple", files);
      }
      if (this.options.autoProcessQueue) {
        return this.processQueue();
      }
    };

    Dropzone.prototype._errorProcessing = function(files, message, xhr) {
      var file, _i, _len;
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        file.status = Dropzone.ERROR;
        this.emit("error", file, message, xhr);
        this.emit("complete", file);
      }
      if (this.options.uploadMultiple) {
        this.emit("errormultiple", files, message, xhr);
        this.emit("completemultiple", files);
      }
      if (this.options.autoProcessQueue) {
        return this.processQueue();
      }
    };

    return Dropzone;

  })(Emitter);

  Dropzone.version = "4.2.0";

  Dropzone.options = {};

  Dropzone.optionsForElement = function(element) {
    if (element.getAttribute("id")) {
      return Dropzone.options[camelize(element.getAttribute("id"))];
    } else {
      return void 0;
    }
  };

  Dropzone.instances = [];

  Dropzone.forElement = function(element) {
    if (typeof element === "string") {
      element = document.querySelector(element);
    }
    if ((element != null ? element.dropzone : void 0) == null) {
      throw new Error("No Dropzone found for given element. This is probably because you're trying to access it before Dropzone had the time to initialize. Use the `init` option to setup any additional observers on your Dropzone.");
    }
    return element.dropzone;
  };

  Dropzone.autoDiscover = true;

  Dropzone.discover = function() {
    var checkElements, dropzone, dropzones, _i, _len, _results;
    if (document.querySelectorAll) {
      dropzones = document.querySelectorAll(".dropzone");
    } else {
      dropzones = [];
      checkElements = function(elements) {
        var el, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = elements.length; _i < _len; _i++) {
          el = elements[_i];
          if (/(^| )dropzone($| )/.test(el.className)) {
            _results.push(dropzones.push(el));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      };
      checkElements(document.getElementsByTagName("div"));
      checkElements(document.getElementsByTagName("form"));
    }
    _results = [];
    for (_i = 0, _len = dropzones.length; _i < _len; _i++) {
      dropzone = dropzones[_i];
      if (Dropzone.optionsForElement(dropzone) !== false) {
        _results.push(new Dropzone(dropzone));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  Dropzone.blacklistedBrowsers = [/opera.*Macintosh.*version\/12/i];

  Dropzone.isBrowserSupported = function() {
    var capableBrowser, regex, _i, _len, _ref;
    capableBrowser = true;
    if (window.File && window.FileReader && window.FileList && window.Blob && window.FormData && document.querySelector) {
      if (!("classList" in document.createElement("a"))) {
        capableBrowser = false;
      } else {
        _ref = Dropzone.blacklistedBrowsers;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          regex = _ref[_i];
          if (regex.test(navigator.userAgent)) {
            capableBrowser = false;
            continue;
          }
        }
      }
    } else {
      capableBrowser = false;
    }
    return capableBrowser;
  };

  without = function(list, rejectedItem) {
    var item, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      item = list[_i];
      if (item !== rejectedItem) {
        _results.push(item);
      }
    }
    return _results;
  };

  camelize = function(str) {
    return str.replace(/[\-_](\w)/g, function(match) {
      return match.charAt(1).toUpperCase();
    });
  };

  Dropzone.createElement = function(string) {
    var div;
    div = document.createElement("div");
    div.innerHTML = string;
    return div.childNodes[0];
  };

  Dropzone.elementInside = function(element, container) {
    if (element === container) {
      return true;
    }
    while (element = element.parentNode) {
      if (element === container) {
        return true;
      }
    }
    return false;
  };

  Dropzone.getElement = function(el, name) {
    var element;
    if (typeof el === "string") {
      element = document.querySelector(el);
    } else if (el.nodeType != null) {
      element = el;
    }
    if (element == null) {
      throw new Error("Invalid `" + name + "` option provided. Please provide a CSS selector or a plain HTML element.");
    }
    return element;
  };

  Dropzone.getElements = function(els, name) {
    var e, el, elements, _i, _j, _len, _len1, _ref;
    if (els instanceof Array) {
      elements = [];
      try {
        for (_i = 0, _len = els.length; _i < _len; _i++) {
          el = els[_i];
          elements.push(this.getElement(el, name));
        }
      } catch (_error) {
        e = _error;
        elements = null;
      }
    } else if (typeof els === "string") {
      elements = [];
      _ref = document.querySelectorAll(els);
      for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
        el = _ref[_j];
        elements.push(el);
      }
    } else if (els.nodeType != null) {
      elements = [els];
    }
    if (!((elements != null) && elements.length)) {
      throw new Error("Invalid `" + name + "` option provided. Please provide a CSS selector, a plain HTML element or a list of those.");
    }
    return elements;
  };

  Dropzone.confirm = function(question, accepted, rejected) {
    if (window.confirm(question)) {
      return accepted();
    } else if (rejected != null) {
      return rejected();
    }
  };

  Dropzone.isValidFile = function(file, acceptedFiles) {
    var baseMimeType, mimeType, validType, _i, _len;
    if (!acceptedFiles) {
      return true;
    }
    acceptedFiles = acceptedFiles.split(",");
    mimeType = file.type;
    baseMimeType = mimeType.replace(/\/.*$/, "");
    for (_i = 0, _len = acceptedFiles.length; _i < _len; _i++) {
      validType = acceptedFiles[_i];
      validType = validType.trim();
      if (validType.charAt(0) === ".") {
        if (file.name.toLowerCase().indexOf(validType.toLowerCase(), file.name.length - validType.length) !== -1) {
          return true;
        }
      } else if (/\/\*$/.test(validType)) {
        if (baseMimeType === validType.replace(/\/.*$/, "")) {
          return true;
        }
      } else {
        if (mimeType === validType) {
          return true;
        }
      }
    }
    return false;
  };

  if (typeof jQuery !== "undefined" && jQuery !== null) {
    jQuery.fn.dropzone = function(options) {
      return this.each(function() {
        return new Dropzone(this, options);
      });
    };
  }

  if (typeof module !== "undefined" && module !== null) {
    module.exports = Dropzone;
  } else {
    window.Dropzone = Dropzone;
  }

  Dropzone.ADDED = "added";

  Dropzone.QUEUED = "queued";

  Dropzone.ACCEPTED = Dropzone.QUEUED;

  Dropzone.UPLOADING = "uploading";

  Dropzone.PROCESSING = Dropzone.UPLOADING;

  Dropzone.CANCELED = "canceled";

  Dropzone.ERROR = "error";

  Dropzone.SUCCESS = "success";


  /*
  
  Bugfix for iOS 6 and 7
  Source: http://stackoverflow.com/questions/11929099/html5-canvas-drawimage-ratio-bug-ios
  based on the work of https://github.com/stomita/ios-imagefile-megapixel
   */

  detectVerticalSquash = function(img) {
    var alpha, canvas, ctx, data, ey, ih, iw, py, ratio, sy;
    iw = img.naturalWidth;
    ih = img.naturalHeight;
    canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = ih;
    ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    data = ctx.getImageData(0, 0, 1, ih).data;
    sy = 0;
    ey = ih;
    py = ih;
    while (py > sy) {
      alpha = data[(py - 1) * 4 + 3];
      if (alpha === 0) {
        ey = py;
      } else {
        sy = py;
      }
      py = (ey + sy) >> 1;
    }
    ratio = py / ih;
    if (ratio === 0) {
      return 1;
    } else {
      return ratio;
    }
  };

  drawImageIOSFix = function(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
    var vertSquashRatio;
    vertSquashRatio = detectVerticalSquash(img);
    return ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh / vertSquashRatio);
  };


  /*
   * contentloaded.js
   *
   * Author: Diego Perini (diego.perini at gmail.com)
   * Summary: cross-browser wrapper for DOMContentLoaded
   * Updated: 20101020
   * License: MIT
   * Version: 1.2
   *
   * URL:
   * http://javascript.nwbox.com/ContentLoaded/
   * http://javascript.nwbox.com/ContentLoaded/MIT-LICENSE
   */

  contentLoaded = function(win, fn) {
    var add, doc, done, init, poll, pre, rem, root, top;
    done = false;
    top = true;
    doc = win.document;
    root = doc.documentElement;
    add = (doc.addEventListener ? "addEventListener" : "attachEvent");
    rem = (doc.addEventListener ? "removeEventListener" : "detachEvent");
    pre = (doc.addEventListener ? "" : "on");
    init = function(e) {
      if (e.type === "readystatechange" && doc.readyState !== "complete") {
        return;
      }
      (e.type === "load" ? win : doc)[rem](pre + e.type, init, false);
      if (!done && (done = true)) {
        return fn.call(win, e.type || e);
      }
    };
    poll = function() {
      var e;
      try {
        root.doScroll("left");
      } catch (_error) {
        e = _error;
        setTimeout(poll, 50);
        return;
      }
      return init("poll");
    };
    if (doc.readyState !== "complete") {
      if (doc.createEventObject && root.doScroll) {
        try {
          top = !win.frameElement;
        } catch (_error) {}
        if (top) {
          poll();
        }
      }
      doc[add](pre + "DOMContentLoaded", init, false);
      doc[add](pre + "readystatechange", init, false);
      return win[add](pre + "load", init, false);
    }
  };

  Dropzone._autoDiscoverFunction = function() {
    if (Dropzone.autoDiscover) {
      return Dropzone.discover();
    }
  };

  contentLoaded(window, Dropzone._autoDiscoverFunction);

}).call(this);

},{}],98:[function(require,module,exports){
/*
attributes
*/"use strict"

var $       = require("./base")

var trim    = require("mout/string/trim"),
    forEach = require("mout/array/forEach"),
    filter  = require("mout/array/filter"),
    indexOf = require("mout/array/indexOf")

// attributes

$.implement({

    setAttribute: function(name, value){
        return this.forEach(function(node){
            node.setAttribute(name, value)
        })
    },

    getAttribute: function(name){
        var attr = this[0].getAttributeNode(name)
        return (attr && attr.specified) ? attr.value : null
    },

    hasAttribute: function(name){
        var node = this[0]
        if (node.hasAttribute) return node.hasAttribute(name)
        var attr = node.getAttributeNode(name)
        return !!(attr && attr.specified)
    },

    removeAttribute: function(name){
        return this.forEach(function(node){
            var attr = node.getAttributeNode(name)
            if (attr) node.removeAttributeNode(attr)
        })
    }

})

var accessors = {}

forEach(["type", "value", "name", "href", "title", "id"], function(name){

    accessors[name] = function(value){
        return (value !== undefined) ? this.forEach(function(node){
            node[name] = value
        }) : this[0][name]
    }

})

// booleans

forEach(["checked", "disabled", "selected"], function(name){

    accessors[name] = function(value){
        return (value !== undefined) ? this.forEach(function(node){
            node[name] = !!value
        }) : !!this[0][name]
    }

})

// className

var classes = function(className){
    var classNames = trim(className).replace(/\s+/g, " ").split(" "),
        uniques    = {}

    return filter(classNames, function(className){
        if (className !== "" && !uniques[className]) return uniques[className] = className
    }).sort()
}

accessors.className = function(className){
    return (className !== undefined) ? this.forEach(function(node){
        node.className = classes(className).join(" ")
    }) : classes(this[0].className).join(" ")
}

// attribute

$.implement({

    attribute: function(name, value){
        var accessor = accessors[name]
        if (accessor) return accessor.call(this, value)
        if (value != null) return this.setAttribute(name, value)
        if (value === null) return this.removeAttribute(name)
        if (value === undefined) return this.getAttribute(name)
    }

})

$.implement(accessors)

// shortcuts

$.implement({

    check: function(){
        return this.checked(true)
    },

    uncheck: function(){
        return this.checked(false)
    },

    disable: function(){
        return this.disabled(true)
    },

    enable: function(){
        return this.disabled(false)
    },

    select: function(){
        return this.selected(true)
    },

    deselect: function(){
        return this.selected(false)
    }

})

// classNames, has / add / remove Class

$.implement({

    classNames: function(){
        return classes(this[0].className)
    },

    hasClass: function(className){
        return indexOf(this.classNames(), className) > -1
    },

    addClass: function(className){
        return this.forEach(function(node){
            var nodeClassName = node.className
            var classNames = classes(nodeClassName + " " + className).join(" ")
            if (nodeClassName !== classNames) node.className = classNames
        })
    },

    removeClass: function(className){
        return this.forEach(function(node){
            var classNames = classes(node.className)
            forEach(classes(className), function(className){
                var index = indexOf(classNames, className)
                if (index > -1) classNames.splice(index, 1)
            })
            node.className = classNames.join(" ")
        })
    },

    toggleClass: function(className, force){
        var add = force !== undefined ? force : !this.hasClass(className)
        if (add)
            this.addClass(className)
        else
            this.removeClass(className)
        return !!add
    }

})

// toString

$.prototype.toString = function(){
    var tag     = this.tag(),
        id      = this.id(),
        classes = this.classNames()

    var str = tag
    if (id) str += '#' + id
    if (classes.length) str += '.' + classes.join(".")
    return str
}

var textProperty = (document.createElement('div').textContent == null) ? 'innerText' : 'textContent'

// tag, html, text, data

$.implement({

    tag: function(){
        return this[0].tagName.toLowerCase()
    },

    html: function(html){
        return (html !== undefined) ? this.forEach(function(node){
            node.innerHTML = html
        }) : this[0].innerHTML
    },

    text: function(text){
        return (text !== undefined) ? this.forEach(function(node){
            node[textProperty] = text
        }) : this[0][textProperty]
    },

    data: function(key, value){
        switch(value) {
            case undefined: return this.getAttribute("data-" + key)
            case null: return this.removeAttribute("data-" + key)
            default: return this.setAttribute("data-" + key, value)
        }
    }

})

module.exports = $

},{"./base":99,"mout/array/filter":139,"mout/array/forEach":143,"mout/array/indexOf":144,"mout/string/trim":237}],99:[function(require,module,exports){
/*
elements
*/"use strict"

var prime   = require("prime")

var forEach = require("mout/array/forEach"),
    map     = require("mout/array/map"),
    filter  = require("mout/array/filter"),
    every   = require("mout/array/every"),
    some    = require("mout/array/some")

// uniqueID

var index = 0,
    __dc = document.__counter,
    counter = document.__counter = (__dc ? parseInt(__dc, 36) + 1 : 0).toString(36),
    key = "uid:" + counter

var uniqueID = function(n){
    if (n === window) return "window"
    if (n === document) return "document"
    if (n === document.documentElement) return "html"
    return n[key] || (n[key] = (index++).toString(36))
}

var instances = {}

// elements prime

var $ = prime({constructor: function $(n, context){

    if (n == null) return (this && this.constructor === $) ? new Elements : null

    var self, uid

    if (n.constructor !== Elements){

        self = new Elements

        if (typeof n === "string"){
            if (!self.search) return null
            self[self.length++] = context || document
            return self.search(n)
        }

        if (n.nodeType || n === window){

            self[self.length++] = n

        } else if (n.length){

            // this could be an array, or any object with a length attribute,
            // including another instance of elements from another interface.

            var uniques = {}

            for (var i = 0, l = n.length; i < l; i++){ // perform elements flattening
                var nodes = $(n[i], context)
                if (nodes && nodes.length) for (var j = 0, k = nodes.length; j < k; j++){
                    var node = nodes[j]
                    uid = uniqueID(node)
                    if (!uniques[uid]){
                        self[self.length++] = node
                        uniques[uid] = true
                    }
                }
            }

        }

    } else {
      self = n
    }

    if (!self.length) return null

    // when length is 1 always use the same elements instance

    if (self.length === 1){
        uid = uniqueID(self[0])
        return instances[uid] || (instances[uid] = self)
    }

    return self

}})

var Elements = prime({

    inherits: $,

    constructor: function Elements(){
        this.length = 0
    },

    unlink: function(){
        return this.map(function(node){
            delete instances[uniqueID(node)]
            return node
        })
    },

    // methods

    forEach: function(method, context){
        forEach(this, method, context)
        return this
    },

    map: function(method, context){
        return map(this, method, context)
    },

    filter: function(method, context){
        return filter(this, method, context)
    },

    every: function(method, context){
        return every(this, method, context)
    },

    some: function(method, context){
        return some(this, method, context)
    }

})

module.exports = $

},{"mout/array/every":138,"mout/array/filter":139,"mout/array/forEach":143,"mout/array/map":149,"mout/array/some":152,"prime":267}],100:[function(require,module,exports){
/*
delegation
*/"use strict"

var Map = require("prime/map")

var $ = require("./events")
        require('./traversal')

$.implement({

    delegate: function(event, selector, handle, useCapture){

        return this.forEach(function(node){

            var self = $(node)

            var delegation = self._delegation || (self._delegation = {}),
                events     = delegation[event] || (delegation[event] = {}),
                map        = (events[selector] || (events[selector] = new Map))

            if (map.get(handle)) return

            var action = function(e){
                var target = $(e.target || e.srcElement),
                    match  = target.matches(selector) ? target : target.parent(selector)

                var res

                if (match) res = handle.call(self, e, match)

                return res
            }

            map.set(handle, action)

            self.on(event, action, useCapture)

        })

    },

    undelegate: function(event, selector, handle, useCapture){

        return this.forEach(function(node){

            var self = $(node), delegation, events, map

            if (!(delegation = self._delegation) || !(events = delegation[event]) || !(map = events[selector])) return;

            var action = map.get(handle)

            if (action){
                self.off(event, action, useCapture)
                map.remove(action)

                // if there are no more handles in a given selector, delete it
                if (!map.count()) delete events[selector]
                // var evc = evd = 0, x
                var e1 = true, e2 = true, x
                for (x in events){
                    e1 = false
                    break
                }
                // if no more selectors in a given event type, delete it
                if (e1) delete delegation[event]
                for (x in delegation){
                    e2 = false
                    break
                }
                // if there are no more delegation events in the element, delete the _delegation object
                if (e2) delete self._delegation
            }

        })

    }

})

module.exports = $

},{"./events":102,"./traversal":105,"prime/map":268}],101:[function(require,module,exports){
/*
domready
*/"use strict"

var $ = require("./events")

var readystatechange = 'onreadystatechange' in document,
    shouldPoll       = false,
    loaded           = false,
    readys           = [],
    checks           = [],
    ready            = null,
    timer            = null,
    test             = document.createElement('div'),
    doc              = $(document),
    win              = $(window)

var domready = function(){

    if (timer) timer = clearTimeout(timer)

    if (!loaded){

        if (readystatechange) doc.off('readystatechange', check)
        doc.off('DOMContentLoaded', domready)
        win.off('load', domready)

        loaded = true

        for (var i = 0; ready = readys[i++];) ready()
    }

    return loaded

}

var check = function(){
    for (var i = checks.length; i--;) if (checks[i]()) return domready()
    return false
}

var poll = function(){
    clearTimeout(timer)
    if (!check()) timer = setTimeout(poll, 1e3 / 60)
}

if (document.readyState){ // use readyState if available

    var complete = function(){
        return !!(/loaded|complete/).test(document.readyState)
    }

    checks.push(complete)

    if (!complete()){ // unless dom is already loaded
        if (readystatechange) doc.on('readystatechange', check) // onreadystatechange event
        else shouldPoll = true //or poll readyState check
    } else { // dom is already loaded
        domready()
    }

}

if (test.doScroll){ // also use doScroll if available (doscroll comes before readyState "complete")

    // LEGAL DEPT:
    // doScroll technique discovered by, owned by, and copyrighted to Diego Perini http://javascript.nwbox.com/IEContentLoaded/

    // testElement.doScroll() throws when the DOM is not ready, only in the top window

    var scrolls = function(){
        try {
            test.doScroll()
            return true
        } catch (e){}
        return false
    }

    // If doScroll works already, it can't be used to determine domready
    // e.g. in an iframe

    if (!scrolls()){
        checks.push(scrolls)
        shouldPoll = true
    }

}

if (shouldPoll) poll()

// make sure that domready fires before load, also if not onreadystatechange and doScroll and DOMContentLoaded load will fire
doc.on('DOMContentLoaded', domready)
win.on('load', domready)

module.exports = function(ready){
    (loaded) ? ready() : readys.push(ready)
    return null
}

},{"./events":102}],102:[function(require,module,exports){
/*
events
*/"use strict"

var Emitter = require("prime/emitter")

var $ = require("./base")

var html = document.documentElement

var addEventListener = html.addEventListener ? function(node, event, handle, useCapture){
    node.addEventListener(event, handle, useCapture || false)
    return handle
} : function(node, event, handle){
    node.attachEvent('on' + event, handle)
    return handle
}

var removeEventListener = html.removeEventListener ? function(node, event, handle, useCapture){
    node.removeEventListener(event, handle, useCapture || false)
} : function(node, event, handle){
    node.detachEvent("on" + event, handle)
}

$.implement({

    on: function(event, handle, useCapture){

        return this.forEach(function(node){
            var self = $(node)

            var internalEvent = event + (useCapture ? ":capture" : "")

            Emitter.prototype.on.call(self, internalEvent, handle)

            var domListeners = self._domListeners || (self._domListeners = {})
            if (!domListeners[internalEvent]) domListeners[internalEvent] = addEventListener(node, event, function(e){
                Emitter.prototype.emit.call(self, internalEvent, e || window.event, Emitter.EMIT_SYNC)
            }, useCapture)
        })
    },

    off: function(event, handle, useCapture){

        return this.forEach(function(node){

            var self = $(node)

            var internalEvent = event + (useCapture ? ":capture" : "")

            var domListeners = self._domListeners, domEvent, listeners = self._listeners, events

            if (domListeners && (domEvent = domListeners[internalEvent]) && listeners && (events = listeners[internalEvent])){

                Emitter.prototype.off.call(self, internalEvent, handle)

                if (!self._listeners || !self._listeners[event]){
                    removeEventListener(node, event, domEvent)
                    delete domListeners[event]

                    for (var l in domListeners) return
                    delete self._domListeners
                }

            }
        })
    },

    emit: function(){
        var args = arguments
        return this.forEach(function(node){
            Emitter.prototype.emit.apply($(node), args)
        })
    }

})

module.exports = $

},{"./base":99,"prime/emitter":266}],103:[function(require,module,exports){
/*
elements
*/"use strict"

var $ = require("./base")
        require("./attributes")
        require("./events")
        require("./insertion")
        require("./traversal")
        require("./delegation")

module.exports = $

},{"./attributes":98,"./base":99,"./delegation":100,"./events":102,"./insertion":104,"./traversal":105}],104:[function(require,module,exports){
/*
insertion
*/"use strict"

var $ = require("./base")

// base insertion

$.implement({

    appendChild: function(child){
        this[0].appendChild($(child)[0])
        return this
    },

    insertBefore: function(child, ref){
        this[0].insertBefore($(child)[0], $(ref)[0])
        return this
    },

    removeChild: function(child){
        this[0].removeChild($(child)[0])
        return this
    },

    replaceChild: function(child, ref){
        this[0].replaceChild($(child)[0], $(ref)[0])
        return this
    }

})

// before, after, bottom, top

$.implement({

    before: function(element){
        element = $(element)[0]
        var parent = element.parentNode
        if (parent) this.forEach(function(node){
            parent.insertBefore(node, element)
        })
        return this
    },

    after: function(element){
        element = $(element)[0]
        var parent = element.parentNode
        if (parent) this.forEach(function(node){
            parent.insertBefore(node, element.nextSibling)
        })
        return this
    },

    bottom: function(element){
        element = $(element)[0]
        return this.forEach(function(node){
            element.appendChild(node)
        })
    },

    top: function(element){
        element = $(element)[0]
        return this.forEach(function(node){
            element.insertBefore(node, element.firstChild)
        })
    }

})

// insert, replace

$.implement({

    insert: $.prototype.bottom,

    remove: function(){
        return this.forEach(function(node){
            var parent = node.parentNode
            if (parent) parent.removeChild(node)
        })
    },

    replace: function(element){
        element = $(element)[0]
        element.parentNode.replaceChild(this[0], element)
        return this
    }

})

module.exports = $

},{"./base":99}],105:[function(require,module,exports){
/*
traversal
*/"use strict"

var map = require("mout/array/map")

var slick = require("slick")

var $ = require("./base")

var gen = function(combinator, expression){
    return map(slick.parse(expression || "*"), function(part){
        return combinator + " " + part
    }).join(", ")
}

var push_ = Array.prototype.push

$.implement({

    search: function(expression){
        if (this.length === 1) return $(slick.search(expression, this[0], new $))

        var buffer = []
        for (var i = 0, node; node = this[i]; i++) push_.apply(buffer, slick.search(expression, node))
        buffer = $(buffer)
        return buffer && buffer.sort()
    },

    find: function(expression){
        if (this.length === 1) return $(slick.find(expression, this[0]))

        for (var i = 0, node; node = this[i]; i++) {
            var found = slick.find(expression, node)
            if (found) return $(found)
        }

        return null
    },

    sort: function(){
        return slick.sort(this)
    },

    matches: function(expression){
        return slick.matches(this[0], expression)
    },

    contains: function(node){
        return slick.contains(this[0], node)
    },

    nextSiblings: function(expression){
        return this.search(gen('~', expression))
    },

    nextSibling: function(expression){
        return this.find(gen('+', expression))
    },

    previousSiblings: function(expression){
        return this.search(gen('!~', expression))
    },

    previousSibling: function(expression){
        return this.find(gen('!+', expression))
    },

    children: function(expression){
        return this.search(gen('>', expression))
    },

    firstChild: function(expression){
        return this.find(gen('^', expression))
    },

    lastChild: function(expression){
        return this.find(gen('!^', expression))
    },

    parent: function(expression){
        var buffer = []
        loop: for (var i = 0, node; node = this[i]; i++) while ((node = node.parentNode) && (node !== document)){
            if (!expression || slick.matches(node, expression)){
                buffer.push(node)
                break loop
                break
            }
        }
        return $(buffer)
    },

    parents: function(expression){
        var buffer = []
        for (var i = 0, node; node = this[i]; i++) while ((node = node.parentNode) && (node !== document)){
            if (!expression || slick.matches(node, expression)) buffer.push(node)
        }
        return $(buffer)
    }

})

module.exports = $

},{"./base":99,"mout/array/map":149,"slick":271}],106:[function(require,module,exports){
/*
zen
*/"use strict"

var forEach = require("mout/array/forEach"),
    map     = require("mout/array/map")

var parse = require("slick/parser")

var $ = require("./base")

module.exports = function(expression, doc){

    return $(map(parse(expression), function(expression){

        var previous, result

        forEach(expression, function(part, i){

            var node = (doc || document).createElement(part.tag)

            if (part.id) node.id = part.id

            if (part.classList) node.className = part.classList.join(" ")

            if (part.attributes) forEach(part.attributes, function(attribute){
                node.setAttribute(attribute.name, attribute.value || "")
            })

            if (part.pseudos) forEach(part.pseudos, function(pseudo){
                var n = $(node), method = n[pseudo.name]
                if (method) method.call(n, pseudo.value)
            })

            if (i === 0){

                result = node

            } else if (part.combinator === " "){

                previous.appendChild(node)

            } else if (part.combinator === "+"){
                var parentNode = previous.parentNode
                if (parentNode) parentNode.appendChild(node)
            }

            previous = node

        })

        return result

    }))

}

},{"./base":99,"mout/array/forEach":143,"mout/array/map":149,"slick/parser":272}],107:[function(require,module,exports){
/*          .-   3
.-.-..-..-.-|-._.
' ' '`-'`-' ' ' '
*/"use strict"

// color and timer
var color = require("./lib/color"),
    frame = require("./lib/frame")

// if we're in a browser we need ./browser, otherwise ./fx
var moofx = (typeof document !== "undefined") ? require("./lib/browser") : require("./lib/fx")

moofx.requestFrame = function(callback){
    frame.request(callback)
    return this
}

moofx.cancelFrame = function(callback){
    frame.cancel(callback)
    return this
}

moofx.color = color

// and export moofx

module.exports = moofx

},{"./lib/browser":108,"./lib/color":109,"./lib/frame":110,"./lib/fx":111}],108:[function(require,module,exports){
(function (global){
/*
MooFx
*/"use strict"

// requires

var color  = require("./color"),
    frame  = require("./frame")

var cancelFrame = frame.cancel,
    requestFrame = frame.request

var prime  = require("prime")

var camelize        = require("prime/string/camelize"),
    clean           = require("prime/string/clean"),
    capitalize      = require("prime/string/capitalize"),
    hyphenateString = require("prime/string/hyphenate")

var map     = require("prime/array/map"),
    forEach = require("prime/array/forEach"),
    indexOf = require("prime/array/indexOf")

var elements = require("elements")

var fx = require("./fx")

// util

var matchString = function(s, r){
    return String.prototype.match.call(s, r);
}

var hyphenated = {}
var hyphenate = function(self){
    return hyphenated[self] || (hyphenated[self] = hyphenateString(self))
}

var round = function(n){
    return Math.round(n * 1e3) / 1e3
}

// compute > node > property

var compute = global.getComputedStyle ? function(node){
    var cts = getComputedStyle(node, null)
    return function(property){
        return cts ? cts.getPropertyValue(hyphenate(property)) : ""
    }
} : /*(css3)?*/function(node){
    var cts = node.currentStyle
    return function(property){
        return cts ? cts[camelize(property)] : ""
    }
}/*:null*/

// pixel ratio retriever

var test = document.createElement("div")

var cssText = "border:none;margin:none;padding:none;visibility:hidden;position:absolute;height:0;";

// returns the amount of pixels that takes to make one of the unit

var pixelRatio = function(element, u){
    var parent = element.parentNode, ratio = 1
    if (parent){
        test.style.cssText = cssText + ("width:100" + u + ";")
        parent.appendChild(test)
        ratio = test.offsetWidth / 100
        parent.removeChild(test)
    }
    return ratio
}

// mirror 4 values

var mirror4 = function(values){
    var length = values.length
    if      (length === 1) values.push(values[0], values[0], values[0])
    else if (length === 2) values.push(values[0], values[1])
    else if (length === 3) values.push(values[1])
    return values
}

// regular expressions strings

var sLength      = "([-.\\d]+)(%|cm|mm|in|px|pt|pc|em|ex|ch|rem|vw|vh|vm)",
    sLengthNum   = sLength + "?",
    sBorderStyle = "none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset|inherit"

// regular expressions

var rgLength     = RegExp(sLength, "g"),
    rLengthNum   = RegExp(sLengthNum),
    rgLengthNum  = RegExp(sLengthNum, "g"),
    rBorderStyle = RegExp(sBorderStyle)

// normalize > css

var parseString = function(value){
    return (value == null) ? "" : value + ""
}

var parseOpacity = function(value, normalize){
    if (value == null || value === "") return normalize ? "1" : ""
    return (isFinite((value = +value))) ? (value < 0 ? "0" : value + "") : "1"
}

try {test.style.color = "rgba(0,0,0,0.5)"} catch(e){}
var rgba = /^rgba/.test(test.style.color)

var parseColor = function(value, normalize){
    var black = "rgba(0,0,0,1)", c
    if (!value || !(c = color(value, true))) return normalize ? black : ""
    if (normalize) return "rgba(" + c + ")"

    var alpha = c[3]
    if (alpha === 0) return "transparent"
    return (!rgba || alpha === 1) ? "rgb(" + c.slice(0, 3) + ")" : "rgba(" + c + ")"
}

var parseLength = function(value, normalize){
    if (value == null || value === "") return normalize ? "0px" : ""
    var match = matchString(value, rLengthNum)
    return match ? match[1] + (match[2] || "px") : value // cannot be parsed. probably "auto"
}

var parseBorderStyle = function(value, normalize){
    if (value == null || value === "") return normalize ? "none" : ""
    var match = value.match(rBorderStyle)
    return match ? value : normalize ? "none" : ""
}

var parseBorder = function(value, normalize){
    var normalized = "0px none rgba(0,0,0,1)"
    if (value == null || value === "")     return normalize ? normalized : ""
    if (value === 0   || value === "none") return normalize ? normalized : value + ""

    var c
    value = value.replace(color.x, function(match){
        c = match
        return ""
    })

    var s = value.match(rBorderStyle),
        l = value.match(rgLengthNum)

    return clean([
        parseLength(l ? l[0] : "", normalize),
        parseBorderStyle(s ? s[0] : "", normalize),
        parseColor(c, normalize)
    ].join(" "))
}

var parseShort4 = function(value, normalize){
    if (value == null || value === "") return normalize ? "0px 0px 0px 0px" : ""
    return clean(mirror4(map(clean(value).split(" "), function(v){
        return parseLength(v, normalize)
    })).join(" "))
}

var parseShadow = function(value, normalize, len){
    var transparent = "rgba(0,0,0,0)",
        normalized  = (len === 3) ? transparent + " 0px 0px 0px" : transparent + " 0px 0px 0px 0px"

    if (value ==  null || value === "") return normalize ? normalized : ""
    if (value === "none") return normalize ? normalized : value

    var colors = [], value = clean(value).replace(color.x, function(match){
        colors.push(match)
        return ""
    })

    return map(value.split(","), function(shadow, i){

        var c       = parseColor(colors[i], normalize),
            inset   = /inset/.test(shadow),
            lengths = shadow.match(rgLengthNum) || ["0px"]

        lengths = map(lengths, function(m){
            return parseLength(m, normalize)
        })

        while (lengths.length < len) lengths.push("0px")

        var ret = inset ? ["inset", c] : [c]

        return ret.concat(lengths).join(" ")

    }).join(", ")
}

var parse = function(value, normalize){
    if (value == null || value === "") return "" // cant normalize "" || null
    return value.replace(color.x, function(match){
        return parseColor(match, normalize)
    }).replace(rgLength, function(match){
        return parseLength(match, normalize)
    })
}

// get && set

var getters = {}, setters = {}, parsers = {}, aliases = {}

var getter = function(key){
    return getters[key] || (getters[key] = (function(){
        var alias  = aliases[key] || key,
            parser = parsers[key] || parse

        return function(){
            return parser(compute(this)(alias), true)
        }

    }()))
}

var setter = function(key){
    return setters[key] || (setters[key] = (function(){

        var alias  = aliases[key] || key,
            parser = parsers[key] || parse

        return function(value){
            this.style[alias] = parser(value, false)
        }

    }()))
}

// parsers

var trbl = ["Top", "Right", "Bottom", "Left"], tlbl = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"]

forEach(trbl, function(d){
    var bd = "border" + d
    forEach([ "margin" + d, "padding" + d, bd + "Width", d.toLowerCase()], function(n){
        parsers[n] = parseLength
    })
    parsers[bd + "Color"] = parseColor
    parsers[bd + "Style"] = parseBorderStyle

    // borderDIR
    parsers[bd] = parseBorder
    getters[bd] = function(){
        return [
            getter(bd + "Width").call(this),
            getter(bd + "Style").call(this),
            getter(bd + "Color").call(this)
        ].join(" ")
    }
})

forEach(tlbl, function(d){
    parsers["border" + d + "Radius"] = parseLength
})

parsers.color = parsers.backgroundColor = parseColor
parsers.width = parsers.height = parsers.minWidth = parsers.minHeight = parsers.maxWidth = parsers.maxHeight = parsers.fontSize = parsers.backgroundSize = parseLength

// margin + padding

forEach(["margin", "padding"], function(name){
    parsers[name] = parseShort4
    getters[name] = function(){
        return map(trbl, function(d){
            return getter(name + d).call(this)
        }, this).join(" ")
    }
})

// borders

// borderDIRWidth, borderDIRStyle, borderDIRColor

parsers.borderWidth = parseShort4

parsers.borderStyle = function(value, normalize){
    if (value == null || value === "") return normalize ? mirror4(["none"]).join(" ") : ""
    value = clean(value).split(" ")
    return clean(mirror4(map(value, function(v){
        parseBorderStyle(v, normalize)
    })).join(" "))
}

parsers.borderColor = function(value, normalize){
    if (!value || !(value = matchString(value, color.x))) return normalize ? mirror4(["rgba(0,0,0,1)"]).join(" ") : ""
    return clean(mirror4(map(value, function(v){
        return parseColor(v, normalize)
    })).join(" "))
}

forEach(["Width", "Style", "Color"], function(name){
    getters["border" + name] = function(){
        return map(trbl, function(d){
            return getter("border" + d + name).call(this)
        }, this).join(" ")
    }
})

// borderRadius

parsers.borderRadius = parseShort4

getters.borderRadius = function(){
    return map(tlbl, function(d){
        return getter("border" + d + "Radius").call(this)
    }, this).join(" ")
}

// border

parsers.border = parseBorder

getters.border = function(){
    var pvalue
    for (var i = 0; i < trbl.length; i++){
        var value = getter("border" + trbl[i]).call(this)
        if (pvalue && value !== pvalue) return null
        pvalue = value
    }
    return pvalue
}

// zIndex

parsers.zIndex = parseString

// opacity

parsers.opacity = parseOpacity

/*(css3)?*/

var filterName = (test.style.MsFilter != null && "MsFilter") || (test.style.filter != null && "filter")

if (filterName && test.style.opacity == null){

    var matchOp = /alpha\(opacity=([\d.]+)\)/i

    setters.opacity = function(value){
        value = ((value = parseOpacity(value)) === "1") ? "" : "alpha(opacity=" + Math.round(value * 100) + ")"
        var filter = compute(this)(filterName)
        return this.style[filterName] = matchOp.test(filter) ? filter.replace(matchOp, value) : filter + " " + value
    }

    getters.opacity = function(){
        var match = compute(this)(filterName).match(matchOp)
        return (!match ? 1 : match[1] / 100) + ""
    }

}/*:*/

var parseBoxShadow = parsers.boxShadow = function(value, normalize){
    return parseShadow(value, normalize, 4)
}

var parseTextShadow = parsers.textShadow = function(value, normalize){
    return parseShadow(value, normalize, 3)
}

// Aliases

forEach(['Webkit', "Moz", "ms", "O", null], function(prefix){
    forEach([
        "transition", "transform", "transformOrigin", "transformStyle", "perspective", "perspectiveOrigin", "backfaceVisibility"
    ], function(style){
        var cc = prefix ? prefix + capitalize(style) : style
        if (prefix === "ms") hyphenated[cc] = "-ms-" + hyphenate(style)
        if (test.style[cc] != null) aliases[style] = cc
    })
})

var transitionName = aliases.transition,
    transformName  = aliases.transform

// manually disable css3 transitions in Opera, because they do not work properly.

if (transitionName === "OTransition") transitionName = null


// this takes care of matrix decomposition on browsers that support only 2d transforms but no CSS3 transitions.
// basically, IE9 (and Opera as well, since we disabled CSS3 transitions manually)

var parseTransform2d, Transform2d

/*(css3)?*/

if (!transitionName && transformName) (function(){

    var unmatrix = require("./unmatrix2d")

    var v = "\\s*([-\\d\\w.]+)\\s*"

    var rMatrix = RegExp("matrix\\(" + [v, v, v, v, v, v] + "\\)")

    var decomposeMatrix = function(matrix){

        var d = unmatrix.apply(null, matrix.match(rMatrix).slice(1)) || [[0, 0], 0, 0, [0, 0]]

        return [

            "translate(" + map(d[0], function(v){return round(v) + "px"}) + ")",
            "rotate(" + round(d[1] * 180 / Math.PI) + "deg)",
            "skewX(" + round(d[2] * 180 / Math.PI) + "deg)",
            "scale(" + map(d[3], round) + ")"

        ].join(" ")

    }

    var def0px  = function(value){return value || "0px"},
        def1    = function(value){return value || "1"},
        def0deg = function(value){return value || "0deg"}

    var transforms = {

        translate: function(value){
            if (!value) value = "0px,0px"
            var values = value.split(",")
            if (!values[1]) values[1] = "0px"
            return map(values, clean) + ""
        },
        translateX: def0px,
        translateY: def0px,
        scale: function(value){
            if (!value) value = "1,1"
            var values = value.split(",")
            if (!values[1]) values[1] = values[0]
            return map(values, clean) + ""
        },
        scaleX: def1,
        scaleY: def1,
        rotate: def0deg,
        skewX: def0deg,
        skewY: def0deg

    }

    Transform2d = prime({

        constructor: function(transform){

            var names = this.names = []
            var values = this.values = []

            transform.replace(/(\w+)\(([-.\d\s\w,]+)\)/g, function(match, name, value){
                names.push(name)
                values.push(value)
            })

        },

        identity: function(){
            var functions = []
            forEach(this.names, function(name){
                var fn = transforms[name]
                if (fn) functions.push(name + "(" + fn() + ")")
            })
            return functions.join(" ")
        },

        sameType: function(transformObject){
            return this.names.toString() === transformObject.names.toString()
        },

        // this is, basically, cheating.
        // retrieving the matrix value from the dom, rather than calculating it

        decompose: function(){
            var transform = this.toString()

            test.style.cssText = cssText + hyphenate(transformName) + ":" + transform + ";"
            document.body.appendChild(test)
            var m = compute(test)(transformName)
            if (!m || m === "none") m = "matrix(1, 0, 0, 1, 0, 0)"
            document.body.removeChild(test)
            return decomposeMatrix(m)
        }

    })

    Transform2d.prototype.toString = function(clean){
        var values = this.values, functions = []
        forEach(this.names, function(name, i){
            var fn = transforms[name]
            if (!fn) return
            var value = fn(values[i])
            if (!clean || value !== fn()) functions.push(name + "(" + value + ")")
        })
        return functions.length ? functions.join(" ") : "none"
    }

    Transform2d.union = function(from, to){

        if (from === to) return // nothing to do

        var fromMap, toMap

        if (from === "none"){

            toMap   = new Transform2d(to)
            to      = toMap.toString()
            from    = toMap.identity()
            fromMap = new Transform2d(from)

        } else if (to === "none"){

            fromMap = new Transform2d(from)
            from    = fromMap.toString()
            to      = fromMap.identity()
            toMap   = new Transform2d(to)

        } else {

            fromMap = new Transform2d(from)
            from    = fromMap.toString()
            toMap   = new Transform2d(to)
            to      = toMap.toString()

        }

        if (from === to) return // nothing to do

        if (!fromMap.sameType(toMap)){

            from = fromMap.decompose()
            to   = toMap.decompose()

        }

        if (from === to) return // nothing to do

        return [from, to]

    }

    // this parser makes sure it never gets "matrix"

    parseTransform2d = parsers.transform = function(transform){
        if (!transform || transform === "none") return "none"
        return new Transform2d(rMatrix.test(transform) ? decomposeMatrix(transform) : transform).toString(true)
    }

    // this getter makes sure we read from the dom only the first time
    // this way we save the actual transform and not "matrix"
    // setting matrix() will use parseTransform2d as well, thus setting the decomposed matrix

    getters.transform = function(){
        var s = this.style
        return s[transformName] || (s[transformName] = parseTransform2d(compute(this)(transformName)))
    }


})()/*:*/

// tries to match from and to values

var prepare = function(node, property, to){

    var parser = parsers[property] || parse,
        from   = getter(property).call(node), // "normalized" by the getter
        to     = parser(to, true) // normalize parsed property

    if (from === to) return

    if (parser === parseLength || parser === parseBorder || parser === parseShort4){

        var toAll = to.match(rgLength), i = 0 // this should always match something

        if (toAll) from = from.replace(rgLength, function(fromFull, fromValue, fromUnit){

            var toFull    = toAll[i++],
                toMatched = toFull.match(rLengthNum),
                toUnit    = toMatched[2]

            if (fromUnit !== toUnit){
                var fromPixels = (fromUnit === "px") ? fromValue : pixelRatio(node, fromUnit) * fromValue
                return round(fromPixels / pixelRatio(node, toUnit)) + toUnit
            }

            return fromFull

        })

        if (i > 0) setter(property).call(node, from)

    }/*(css3)?*/else if (parser === parseTransform2d){ // IE9/Opera

        return Transform2d.union(from, to)

    }/*:*/

    return (from !== to) ? [from, to] : null

}

// BrowserAnimation

var BrowserAnimation = prime({

    inherits: fx,

    constructor: function BrowserAnimation(node, property){

        var _getter = getter(property),
            _setter = setter(property)

        this.get = function(){
            return _getter.call(node)
        }

        this.set = function(value){
            return _setter.call(node, value)
        }

        BrowserAnimation.parent.constructor.call(this, this.set)

        this.node = node
        this.property = property

    }

})

var JSAnimation

/*(css3)?*/

JSAnimation = prime({

    inherits: BrowserAnimation,

    constructor: function JSAnimation(){
        return JSAnimation.parent.constructor.apply(this, arguments)
    },

    start: function(to){

        this.stop()

        if (this.duration === 0){
            this.cancel(to)
            return this
        }

        var fromTo = prepare(this.node, this.property, to)

        if (!fromTo){
            this.cancel(to)
            return this
        }

        JSAnimation.parent.start.apply(this, fromTo)

        if (!this.cancelStep) return this

        // the animation would have started but we need additional checks

        var parser = parsers[this.property] || parse

        // complex interpolations JSAnimation can't handle
        // even CSS3 animation gracefully fail with some of those edge cases
        // other "simple" properties, such as `border` can have different templates
        // because of string properties like "solid" and "dashed"

        if ((parser === parseBoxShadow || parser === parseTextShadow || parser === parse) &&
            (this.templateFrom !== this.templateTo)){
                this.cancelStep()
                delete this.cancelStep
                this.cancel(to)
        }

        return this
    },

    parseEquation: function(equation){
        if (typeof equation === "string") return JSAnimation.parent.parseEquation.call(this, equation)
    }


})/*:*/

// CSSAnimation

var remove3 = function(value, a, b, c){
    var index = indexOf(a, value)
    if (index !== -1){
        a.splice(index, 1)
        b.splice(index, 1)
        c.splice(index, 1)
    }
}

var CSSAnimation = prime({

    inherits: BrowserAnimation,

    constructor: function CSSAnimation(node, property){
        CSSAnimation.parent.constructor.call(this, node, property)

        this.hproperty = hyphenate(aliases[property] || property)

        var self = this

        this.bSetTransitionCSS = function(time){
            self.setTransitionCSS(time)
        }

        this.bSetStyleCSS = function(time){
            self.setStyleCSS(time)
        }

        this.bComplete = function(){
            self.complete()
        }
    },

    start: function(to){

        this.stop()

        if (this.duration === 0){
            this.cancel(to)
            return this
        }

        var fromTo = prepare(this.node, this.property, to)

        if (!fromTo){
            this.cancel(to)
            return this
        }

        this.to = fromTo[1]
        // setting transition styles immediately will make good browsers behave weirdly
        // because DOM changes are always deferred, so we requestFrame
        this.cancelSetTransitionCSS = requestFrame(this.bSetTransitionCSS)

        return this
    },

    setTransitionCSS: function(time){
        delete this.cancelSetTransitionCSS
        this.resetCSS(true)
        // firefox flickers if we set css for transition as well as styles at the same time
        // so, other than deferring transition styles we defer actual styles as well on a requestFrame
        this.cancelSetStyleCSS = requestFrame(this.bSetStyleCSS)
    },

    setStyleCSS: function(time){
        delete this.cancelSetStyleCSS
        var duration = this.duration
        // we use setTimeout instead of transitionEnd because some browsers (looking at you foxy)
        // incorrectly set event.propertyName, so we cannot check which animation we are canceling
        this.cancelComplete = setTimeout(this.bComplete, duration)
        this.endTime = time + duration
        this.set(this.to)
    },

    complete: function(){
        delete this.cancelComplete
        this.resetCSS()
        this.callback(this.endTime)
    },

    stop: function(hard){
        if (this.cancelExit){
            this.cancelExit()
            delete this.cancelExit
        } else if (this.cancelSetTransitionCSS){
            // if cancelSetTransitionCSS is set, means nothing is set yet
            this.cancelSetTransitionCSS() //so we cancel and we're good
            delete this.cancelSetTransitionCSS
        } else if (this.cancelSetStyleCSS){
            // if cancelSetStyleCSS is set, means transition css has been set, but no actual styles.
            this.cancelSetStyleCSS()
            delete this.cancelSetStyleCSS
            // if its a hard stop (and not another start on top of the current animation)
            // we need to reset the transition CSS
            if (hard) this.resetCSS()
        } else if (this.cancelComplete){
            // if cancelComplete is set, means style and transition css have been set, not yet completed.
            clearTimeout(this.cancelComplete)
            delete this.cancelComplete
            // if its a hard stop (and not another start on top of the current animation)
            // we need to reset the transition CSS set the current animation styles
            if (hard){
                this.resetCSS()
                this.set(this.get())
            }
        }
        return this
    },

    resetCSS: function(inclusive){
        var rules      = compute(this.node),
            properties = (rules(transitionName + "Property").replace(/\s+/g, "") || "all").split(","),
            durations  = (rules(transitionName + "Duration").replace(/\s+/g, "") || "0s").split(","),
            equations  = (rules(transitionName + "TimingFunction").replace(/\s+/g, "") || "ease").match(/cubic-bezier\([\d-.,]+\)|([a-z-]+)/g)

        remove3("all",          properties, durations, equations)
        remove3(this.hproperty, properties, durations, equations)

        if (inclusive){
            properties.push(this.hproperty)
            durations.push(this.duration + "ms")
            equations.push("cubic-bezier(" + this.equation + ")")
        }

        var nodeStyle = this.node.style

        nodeStyle[transitionName + "Property"]       = properties
        nodeStyle[transitionName + "Duration"]       = durations
        nodeStyle[transitionName + "TimingFunction"] = equations
    },

    parseEquation: function(equation){
        if (typeof equation === "string") return CSSAnimation.parent.parseEquation.call(this, equation, true)
    }

})

// elements methods

var BaseAnimation = transitionName ? CSSAnimation : JSAnimation

var moofx = function(x, y){
    return (typeof x === "function") ? fx(x) : elements(x, y)
}

elements.implement({

    // {properties}, options or
    // property, value options
    animate: function(A, B, C){

        var styles = A, options = B

        if (typeof A === "string"){
            styles = {}
            styles[A] = B
            options = C
        }

        if (options == null) options = {}

        var type = typeof options

        options = type === "function" ? {
            callback: options
        } : (type === "string" || type === "number") ? {
            duration: options
        } : options

        var callback  = options.callback || function(){},
            completed = 0,
            length    = 0

        options.callback = function(t){
            if (++completed === length) callback(t)
        }

        for (var property in styles){

            var value    = styles[property],
                property = camelize(property)

            this.forEach(function(node){
                length++
                var self = elements(node), anims = self._animations || (self._animations = {})
                var anim  = anims[property] || (anims[property] = new BaseAnimation(node, property))
                anim.setOptions(options).start(value)
            })
        }

        return this

    },

    // {properties} or
    // property, value
    style: function(A, B){

        var styles = A

        if (typeof A === "string"){
            styles = {}
            styles[A] = B
        }

        for (var property in styles){
            var value = styles[property],
                set   = setter(property = camelize(property))

            this.forEach(function(node){
                var self = elements(node), anims = self._animations, anim
                if (anims && (anim = anims[property])) anim.stop(true)
                set.call(node, value)
            })
        }

        return this

    },

    compute: function(property){

        property = camelize(property)
        var node = this[0]

        // return default matrix for transform, instead of parsed (for consistency)

        if (property === "transform" && parseTransform2d) return compute(node)(transformName)

        var value = getter(property).call(node)

        // unit conversion to `px`

        return (value != null) ? value.replace(rgLength, function(match, value, unit){
            return (unit === "px") ? match : pixelRatio(node, unit) * value + "px"
        }) : ''

    }

})

moofx.parse = function(property, value, normalize){
    return (parsers[camelize(property)] || parse)(value, normalize)
}

module.exports = moofx

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./color":109,"./frame":110,"./fx":111,"./unmatrix2d":112,"elements":113,"prime":120,"prime/array/forEach":116,"prime/array/indexOf":117,"prime/array/map":118,"prime/string/camelize":127,"prime/string/capitalize":128,"prime/string/clean":129,"prime/string/hyphenate":130}],109:[function(require,module,exports){
/*
color
*/"use strict"

var colors = {
    maroon      : "#800000",
    red         : "#ff0000",
    orange      : "#ffA500",
    yellow      : "#ffff00",
    olive       : "#808000",
    purple      : "#800080",
    fuchsia     : "#ff00ff",
    white       : "#ffffff",
    lime        : "#00ff00",
    green       : "#008000",
    navy        : "#000080",
    blue        : "#0000ff",
    aqua        : "#00ffff",
    teal        : "#008080",
    black       : "#000000",
    silver      : "#c0c0c0",
    gray        : "#808080",
    transparent : "#0000"
}

var RGBtoRGB = function(r, g, b, a){
    if (a == null || a === "") a = 1
    r = parseFloat(r)
    g = parseFloat(g)
    b = parseFloat(b)
    a = parseFloat(a)
    if (!(r <= 255 && r >= 0 && g <= 255 && g >= 0 && b <= 255 && b >= 0 && a <= 1 && a >= 0)) return null

    return [Math.round(r), Math.round(g), Math.round(b), a]
}

var HEXtoRGB = function(hex){
    if (hex.length === 3) hex += "f"
    if (hex.length === 4){
        var h0 = hex.charAt(0),
            h1 = hex.charAt(1),
            h2 = hex.charAt(2),
            h3 = hex.charAt(3)

        hex = h0 + h0 + h1 + h1 + h2 + h2 + h3 + h3
    }
    if (hex.length === 6) hex += "ff"
    var rgb = []
    for (var i = 0, l = hex.length; i < l; i += 2) rgb.push(parseInt(hex.substr(i, 2), 16) / (i === 6 ? 255 : 1))
    return rgb
}

// HSL to RGB conversion from:
// http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
// thank you!

var HUEtoRGB = function(p, q, t){
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
}

var HSLtoRGB = function(h, s, l, a){
    var r, b, g
    if (a == null || a === "") a = 1
    h = parseFloat(h) / 360
    s = parseFloat(s) / 100
    l = parseFloat(l) / 100
    a = parseFloat(a) / 1
    if (h > 1 || h < 0 || s > 1 || s < 0 || l > 1 || l < 0 || a > 1 || a < 0) return null
    if (s === 0){
        r = b = g = l
    } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s
        var p = 2 * l - q
        r = HUEtoRGB(p, q, h + 1 / 3)
        g = HUEtoRGB(p, q, h)
        b = HUEtoRGB(p, q, h - 1 / 3)
    }
    return [r * 255, g * 255, b * 255, a]
}

var keys = []
for (var c in colors) keys.push(c)

var shex  = "(?:#([a-f0-9]{3,8}))",
    sval  = "\\s*([.\\d%]+)\\s*",
    sop   = "(?:,\\s*([.\\d]+)\\s*)?",
    slist = "\\(" + [sval, sval, sval] + sop + "\\)",
    srgb  = "(?:rgb)a?",
    shsl  = "(?:hsl)a?",
    skeys = "(" + keys.join("|") + ")"


var xhex   = RegExp(shex, "i"),
    xrgb   = RegExp(srgb + slist, "i"),
    xhsl   = RegExp(shsl + slist, "i")

var color = function(input, array){
    if (input == null) return null
    input = (input + "").replace(/\s+/, "")

    var match = colors[input]
    if (match){
        return color(match, array)
    } else if (match = input.match(xhex)){
        input = HEXtoRGB(match[1])
    } else if (match = input.match(xrgb)){
        input = match.slice(1)
    } else if (match = input.match(xhsl)){
        input = HSLtoRGB.apply(null, match.slice(1))
    } else return null

    if (!(input && (input = RGBtoRGB.apply(null, input)))) return null
    if (array) return input
    if (input[3] === 1) input.splice(3, 1)
    return "rgb" + (input.length === 4 ? "a" : "") + "(" + input + ")"
}

color.x = RegExp([skeys, shex, srgb + slist, shsl + slist].join("|"), "gi")

module.exports = color

},{}],110:[function(require,module,exports){
(function (global){
/*
requestFrame / cancelFrame
*/"use strict"

var indexOf = require("prime/array/indexOf")

var requestFrame = global.requestAnimationFrame ||
                   global.webkitRequestAnimationFrame ||
                   global.mozRequestAnimationFrame ||
                   global.oRequestAnimationFrame ||
                   global.msRequestAnimationFrame ||
                   function(callback){
                       return setTimeout(function(){
                           callback()
                       }, 1e3 / 60)
                   }

var callbacks = []

var iterator = function(time){
    var split = callbacks.splice(0, callbacks.length)
    for (var i = 0, l = split.length; i < l; i++) split[i](time || (time = +(new Date)))
}

var cancel = function(callback){
    var io = indexOf(callbacks, callback)
    if (io > -1) callbacks.splice(io, 1)
}

var request = function(callback){
    var i = callbacks.push(callback)
    if (i === 1) requestFrame(iterator)
    return function(){
        cancel(callback)
    }
}

exports.request = request
exports.cancel = cancel

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"prime/array/indexOf":117}],111:[function(require,module,exports){
/*
fx
*/"use strict"

var prime        = require("prime"),
    requestFrame = require("./frame").request,
    bezier       = require("cubic-bezier")

var map = require("prime/array/map")

var sDuration    = "([\\d.]+)(s|ms)?",
    sCubicBezier = "cubic-bezier\\(([-.\\d]+),([-.\\d]+),([-.\\d]+),([-.\\d]+)\\)"

var rDuration     = RegExp(sDuration),
    rCubicBezier  = RegExp(sCubicBezier),
    rgCubicBezier = RegExp(sCubicBezier, "g")

    // equations collection

var equations = {
    "default"     : "cubic-bezier(0.25, 0.1, 0.25, 1.0)",
    "linear"      : "cubic-bezier(0, 0, 1, 1)",
    "ease-in"     : "cubic-bezier(0.42, 0, 1.0, 1.0)",
    "ease-out"    : "cubic-bezier(0, 0, 0.58, 1.0)",
    "ease-in-out" : "cubic-bezier(0.42, 0, 0.58, 1.0)"
}

equations.ease = equations["default"]

var compute = function(from, to, delta){
    return (to - from) * delta + from
}

var divide = function(string){
    var numbers = []
    var template = (string + "").replace(/[-.\d]+/g, function(number){
        numbers.push(+number)
        return "@"
    })
    return [numbers, template]
}

var Fx = prime({

    constructor: function Fx(render, options){

        // set options

        this.setOptions(options)

        // renderer

        this.render = render || function(){}

        // bound functions

        var self = this

        this.bStep = function(t){
            return self.step(t)
        }

        this.bExit = function(time){
            self.exit(time)
        }

    },

    setOptions: function(options){
        if (options == null) options = {}

        if (!(this.duration = this.parseDuration(options.duration || "500ms"))) throw new Error("invalid duration")
        if (!(this.equation = this.parseEquation(options.equation || "default"))) throw new Error("invalid equation")
        this.callback = options.callback || function(){}

        return this
    },

    parseDuration: function(duration){
        if (duration = (duration + "").match(rDuration)){
            var time = +duration[1],
                unit = duration[2] || "ms"

            if (unit === "s")  return time * 1e3
            if (unit === "ms") return time
        }
    },

    parseEquation: function(equation, array){
        var type = typeof equation

        if (type === "function"){ // function
            return equation
        } else if (type === "string"){ // cubic-bezier string
            equation = equations[equation] || equation
            var match = equation.replace(/\s+/g, "").match(rCubicBezier)
            if (match){
                equation = map(match.slice(1), function(v){return +v})
                if (array) return equation
                if (equation.toString() === "0,0,1,1") return function(x){return x}
                type = "object"
            }
        }

        if (type === "object"){ // array
            return bezier(equation[0], equation[1], equation[2], equation[3], 1e3 / 60 / this.duration / 4)
        }
    },

    cancel: function(to){
        this.to = to
        this.cancelExit = requestFrame(this.bExit)
    },

    exit: function(time){
        this.render(this.to)
        delete this.cancelExit
        this.callback(time)
    },

    start: function(from, to){

        this.stop()

        if (this.duration === 0){
            this.cancel(to)
            return this
        }

        this.isArray = false
        this.isNumber = false

        var fromType = typeof from,
            toType   = typeof to

        if (fromType === "object" && toType === "object"){
            this.isArray = true
        } else if (fromType === "number" && toType === "number"){
            this.isNumber = true
        }

        var from_ = divide(from),
            to_   = divide(to)

        this.from = from_[0]
        this.to = to_[0]
        this.templateFrom = from_[1]
        this.templateTo = to_[1]

        if (this.from.length !== this.to.length || this.from.toString() === this.to.toString()){
            this.cancel(to)
            return this
        }

        delete this.time
        this.length = this.from.length
        this.cancelStep = requestFrame(this.bStep)

        return this

    },

    stop: function(){

        if (this.cancelExit){
            this.cancelExit()
            delete this.cancelExit
        } else if (this.cancelStep){
            this.cancelStep()
            delete this.cancelStep
        }

        return this
    },

    step: function(now){

        this.time || (this.time = now)

        var factor = (now - this.time) / this.duration

        if (factor > 1) factor = 1

        var delta = this.equation(factor),
            from  = this.from,
            to    = this.to,
            tpl   = this.templateTo

        for (var i = 0, l = this.length; i < l; i++){
            var f = from[i], t = to[i]
            tpl = tpl.replace("@", t !== f ? compute(f, t, delta) : t)
        }

        this.render(this.isArray ? tpl.split(",") : this.isNumber ? +tpl : tpl, factor)

        if (factor !== 1){
            this.cancelStep = requestFrame(this.bStep)
        } else {
            delete this.cancelStep
            this.callback(now)
        }

    }

})

var fx = function(render){

    var ffx = new Fx(render)

    return {

        start: function(from, to, options){
            var type = typeof options
            ffx.setOptions((type === "function") ? {
                callback: options
            } : (type === "string" || type === "number") ? {
                duration: options
            } : options).start(from, to)
            return this
        },

        stop: function(){
            ffx.stop()
            return this
        }

    }

}

fx.prototype = Fx.prototype

module.exports = fx

},{"./frame":110,"cubic-bezier":96,"prime":120,"prime/array/map":118}],112:[function(require,module,exports){
/*
Unmatrix 2d
 - a crude implementation of the slightly bugged pseudo code in http://www.w3.org/TR/css3-2d-transforms/#matrix-decomposition
*/"use strict"

// returns the length of the passed vector

var length = function(a){
    return Math.sqrt(a[0] * a[0] + a[1] * a[1])
}

// normalizes the length of the passed point to 1

var normalize = function(a){
    var l = length(a)
    return l ? [a[0] / l, a[1] / l] : [0, 0]
}

// returns the dot product of the passed points

var dot = function(a, b){
    return a[0] * b[0] + a[1] * b[1]
}

// returns the principal value of the arc tangent of
// y/x, using the signs of both arguments to determine
// the quadrant of the return value

var atan2 = Math.atan2

var combine = function(a, b, ascl, bscl){
    return [
        (ascl * a[0]) + (bscl * b[0]),
        (ascl * a[1]) + (bscl * b[1])
    ]
}

module.exports = function(a, b, c, d, tx, ty){

    // Make sure the matrix is invertible

    if ((a * d - b * c) === 0) return false

    // Take care of translation

    var translate = [tx, ty]

    // Put the components into a 2x2 matrix

    var m = [[a, b], [c, d]]

    // Compute X scale factor and normalize first row.

    var scale = [length(m[0])]
    m[0] = normalize(m[0])

    // Compute shear factor and make 2nd row orthogonal to 1st.

    var skew = dot(m[0], m[1])
    m[1] = combine(m[1], m[0], 1, -skew)

    // Now, compute Y scale and normalize 2nd row.

    scale[1] = length(m[1])
    // m[1] = normalize(m[1]) //
    skew /= scale[1]

    // Now, get the rotation out

    var rotate = atan2(m[0][1], m[0][0])

    return [translate, rotate, skew, scale]

}

},{}],113:[function(require,module,exports){
(function (global){
/*
elements
*/"use strict"

var prime   = require("prime"),
    forEach = require("prime/array/forEach"),
    map     = require("prime/array/map"),
    filter  = require("prime/array/filter"),
    every   = require("prime/array/every"),
    some    = require("prime/array/some")

// uniqueID

var uniqueIndex = 0
var uniqueID = function(n){
    return (n === global) ? "global" : n.uniqueNumber || (n.uniqueNumber = "n:" + (uniqueIndex++).toString(36))
}

var instances = {}

// elements prime

var $ = prime({constructor: function $(n, context){

    if (n == null) return (this && this.constructor === $) ? new elements : null

    var self = n

    if (n.constructor !== elements){

        self = new elements

        var uid

        if (typeof n === "string"){
            if (!self.search) return null
            self[self.length++] = context || document
            return self.search(n)
        }

        if (n.nodeType || n === global){

            self[self.length++] = n

        } else if (n.length){

            // this could be an array, or any object with a length attribute,
            // including another instance of elements from another interface.

            var uniques = {}

            for (var i = 0, l = n.length; i < l; i++){ // perform elements flattening
                var nodes = $(n[i], context)
                if (nodes && nodes.length) for (var j = 0, k = nodes.length; j < k; j++){
                    var node = nodes[j]
                    uid = uniqueID(node)
                    if (!uniques[uid]){
                        self[self.length++] = node
                        uniques[uid] = true
                    }
                }
            }

        }

    }

    if (!self.length) return null

    // when length is 1 always use the same elements instance

    if (self.length === 1){
        uid = uniqueID(self[0])
        return instances[uid] || (instances[uid] = self)
    }

    return self

}})

var elements = prime({

    inherits: $,

    constructor: function elements(){
        this.length = 0
    },

    unlink: function(){
        return this.map(function(node, i){
            delete instances[uniqueID(node)]
            return node
        })
    },

    // straight es5 prototypes (or emulated methods)

    forEach: function(method, context){
        return forEach(this, method, context);
    },

    map: function(method, context){
        return map(this, method, context);
    },

    filter: function(method, context){
        return filter(this, method, context);
    },

    every: function(method, context){
        return every(this, method, context);
    },

    some: function(method, context){
        return some(this, method, context);
    }

})

module.exports = $

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"prime":120,"prime/array/every":114,"prime/array/filter":115,"prime/array/forEach":116,"prime/array/map":118,"prime/array/some":119}],114:[function(require,module,exports){
/*
array:every
*/"use strict"

var every = function(self, method, context){
    for (var i = 0, l = self.length >>> 0; i < l; i++){
        if (!method.call(context, self[i], i, self)) return false
    }
    return true
}

module.exports = every

},{}],115:[function(require,module,exports){
/*
array:filter
*/"use strict"

var filter = function(self, method, context){
    var results = []
    for (var i = 0, l = self.length >>> 0; i < l; i++) {
        var value = self[i]
        if (method.call(context, value, i, self)) results.push(value)
    }
    return results
}

module.exports = filter

},{}],116:[function(require,module,exports){
/*
array:forEach
*/"use strict"

var forEach = function(self, method, context){
    for (var i = 0, l = self.length >>> 0; i < l; i++){
        if (method.call(context, self[i], i, self) === false) break
    }
    return self
}

module.exports = forEach

},{}],117:[function(require,module,exports){
/*
array:indexOf
*/"use strict"

var indexOf = function(self, item, from){
    for (var l = self.length >>> 0, i = (from < 0) ? Math.max(0, l + from) : from || 0; i < l; i++){
        if (self[i] === item) return i
    }
    return -1
}

module.exports = indexOf

},{}],118:[function(require,module,exports){
/*
array:map
*/"use strict"

var map = function(self, method, context){
    var length = self.length >>> 0, results = Array(length)
    for (var i = 0, l = length; i < l; i++){
        results[i] = method.call(context, self[i], i, self)
    }
    return results
}

module.exports = map

},{}],119:[function(require,module,exports){
/*
array:some
*/"use strict"

var some = function(self, method, context){
    for (var i = 0, l = self.length >>> 0; i < l; i++){
        if (method.call(context, self[i], i, self)) return true
    }
    return false
}

module.exports = some

},{}],120:[function(require,module,exports){
/*
prime
 - prototypal inheritance
*/"use strict"

var hasOwn = require("./object/hasOwn"),
    forIn  = require("./object/forIn"),
    mixIn  = require("./object/mixIn"),
    filter = require("./object/filter"),
    create = require("./object/create"),
    type   = require("./type")

var defineProperty           = Object.defineProperty,
    getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor

try {
    defineProperty({}, "~", {})
    getOwnPropertyDescriptor({}, "~")
} catch (e){
    defineProperty = null
    getOwnPropertyDescriptor = null
}

var define = function(value, key, from){
    defineProperty(this, key, getOwnPropertyDescriptor(from, key) || {
        writable: true,
        enumerable: true,
        configurable: true,
        value: value
    })
}

var copy = function(value, key){
    this[key] = value
}

var implement = function(proto){
    forIn(proto, defineProperty ? define : copy, this.prototype)
    return this
}

var verbs = /^constructor|inherits|mixin$/

var prime = function(proto){

    if (type(proto) === "function") proto = {constructor: proto}

    var superprime = proto.inherits

    // if our nice proto object has no own constructor property
    // then we proceed using a ghosting constructor that all it does is
    // call the parent's constructor if it has a superprime, else an empty constructor
    // proto.constructor becomes the effective constructor
    var constructor = (hasOwn(proto, "constructor")) ? proto.constructor : (superprime) ? function(){
        return superprime.apply(this, arguments)
    } : function(){}

    if (superprime){

        mixIn(constructor, superprime)

        var superproto = superprime.prototype
        // inherit from superprime
        var cproto = constructor.prototype = create(superproto)

        // setting constructor.parent to superprime.prototype
        // because it's the shortest possible absolute reference
        constructor.parent = superproto
        cproto.constructor = constructor
    }

    if (!constructor.implement) constructor.implement = implement

    var mixins = proto.mixin
    if (mixins){
        if (type(mixins) !== "array") mixins = [mixins]
        for (var i = 0; i < mixins.length; i++) constructor.implement(create(mixins[i].prototype))
    }

    // implement proto and return constructor
    return constructor.implement(filter(proto, function(value, key){
        return !key.match(verbs)
    }))

}

module.exports = prime

},{"./object/create":121,"./object/filter":122,"./object/forIn":123,"./object/hasOwn":125,"./object/mixIn":126,"./type":132}],121:[function(require,module,exports){
/*
object:create
*/"use strict"

var create = function(self){
    var constructor = function(){}
    constructor.prototype = self
    return new constructor
}

module.exports = create

},{}],122:[function(require,module,exports){
/*
object:filter
*/"use strict"

var forIn = require("./forIn")

var filter = function(self, method, context){
    var results = {}
    forIn(self, function(value, key){
        if (method.call(context, value, key, self)) results[key] = value
    })
    return results
}

module.exports = filter

},{"./forIn":123}],123:[function(require,module,exports){
/*
object:forIn
*/"use strict"

var has = require("./hasOwn")

var forIn = function(self, method, context){
    for (var key in self) if (method.call(context, self[key], key, self) === false) break
    return self
}

if (!({valueOf: 0}).propertyIsEnumerable("valueOf")){ // fix for stupid IE enumeration bug

    var buggy = "constructor,toString,valueOf,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString".split(",")
    var proto = Object.prototype

    forIn = function(self, method, context){
        for (var key in self) if (method.call(context, self[key], key, self) === false) return self
        for (var i = 0; key = buggy[i]; i++){
            var value = self[key]
            if ((value !== proto[key] || has(self, key)) && method.call(context, value, key, self) === false) break
        }
        return self
    }

}

module.exports = forIn

},{"./hasOwn":125}],124:[function(require,module,exports){
/*
object:forOwn
*/"use strict"

var forIn  = require("./forIn"),
    hasOwn = require("./hasOwn")

var forOwn = function(self, method, context){
    forIn(self, function(value, key){
        if (hasOwn(self, key)) return method.call(context, value, key, self)
    })
    return self
}

module.exports = forOwn

},{"./forIn":123,"./hasOwn":125}],125:[function(require,module,exports){
/*
object:hasOwn
*/"use strict"

var hasOwnProperty = Object.hasOwnProperty

var hasOwn = function(self, key){
    return hasOwnProperty.call(self, key)
}

module.exports = hasOwn

},{}],126:[function(require,module,exports){
/*
object:mixIn
*/"use strict"

var forOwn = require("./forOwn")

var copy = function(value, key){
    this[key] = value
}

var mixIn = function(self){
    for (var i = 1, l = arguments.length; i < l; i++) forOwn(arguments[i], copy, self)
    return self
}

module.exports = mixIn

},{"./forOwn":124}],127:[function(require,module,exports){
/*
string:camelize
*/"use strict"

var camelize = function(self){
    return (self + "").replace(/-\D/g, function(match){
        return match.charAt(1).toUpperCase()
    })
}

module.exports = camelize

},{}],128:[function(require,module,exports){
/*
string:capitalize
*/"use strict"

var capitalize = function(self){
    return (self + "").replace(/\b[a-z]/g, function(match){
        return match.toUpperCase()
    })
}

module.exports = capitalize

},{}],129:[function(require,module,exports){
/*
string:clean
*/"use strict"

var trim = require("./trim")

var clean = function(self){
    return trim((self + "").replace(/\s+/g, " "))
}

module.exports = clean

},{"./trim":131}],130:[function(require,module,exports){
/*
string:hyphenate
*/"use strict"

var hyphenate = function(self){
    return (self + "").replace(/[A-Z]/g, function(match){
        return '-' + match.toLowerCase()
    })
}

module.exports = hyphenate

},{}],131:[function(require,module,exports){
/*
string:trim
*/"use strict"

var trim = function(self){
    return (self + "").replace(/^\s+|\s+$/g, "")
}

module.exports = trim

},{}],132:[function(require,module,exports){
/*
type
*/"use strict"

var toString = Object.prototype.toString,
    types = /number|object|array|string|function|date|regexp|boolean/

var type = function(object){
    if (object == null) return "null"
    var string = toString.call(object).slice(8, -1).toLowerCase()
    if (string === "number" && isNaN(object)) return "null"
    if (types.test(string)) return string
    return "object"
}

module.exports = type

},{}],133:[function(require,module,exports){


    /**
     * Appends an array to the end of another.
     * The first array will be modified.
     */
    function append(arr1, arr2) {
        if (arr2 == null) {
            return arr1;
        }

        var pad = arr1.length,
            i = -1,
            len = arr2.length;
        while (++i < len) {
            arr1[pad + i] = arr2[i];
        }
        return arr1;
    }
    module.exports = append;


},{}],134:[function(require,module,exports){
var indexOf = require('./indexOf');

    /**
     * Combines an array with all the items of another.
     * Does not allow duplicates and is case and type sensitive.
     */
    function combine(arr1, arr2) {
        if (arr2 == null) {
            return arr1;
        }

        var i = -1, len = arr2.length;
        while (++i < len) {
            if (indexOf(arr1, arr2[i]) === -1) {
                arr1.push(arr2[i]);
            }
        }

        return arr1;
    }
    module.exports = combine;


},{"./indexOf":144}],135:[function(require,module,exports){
var indexOf = require('./indexOf');

    /**
     * If array contains values.
     */
    function contains(arr, val) {
        return indexOf(arr, val) !== -1;
    }
    module.exports = contains;


},{"./indexOf":144}],136:[function(require,module,exports){
var unique = require('./unique');
var filter = require('./filter');
var some = require('./some');
var contains = require('./contains');
var slice = require('./slice');


    /**
     * Return a new Array with elements that aren't present in the other Arrays.
     */
    function difference(arr) {
        var arrs = slice(arguments, 1),
            result = filter(unique(arr), function(needle){
                return !some(arrs, function(haystack){
                    return contains(haystack, needle);
                });
            });
        return result;
    }

    module.exports = difference;



},{"./contains":135,"./filter":139,"./slice":151,"./some":152,"./unique":154}],137:[function(require,module,exports){
var is = require('../lang/is');
var isArray = require('../lang/isArray');
var every = require('./every');

    /**
     * Compares if both arrays have the same elements
     */
    function equals(a, b, callback){
        callback = callback || is;

        if (!isArray(a) || !isArray(b)) {
            return callback(a, b);
        }

        if (a.length !== b.length) {
            return false;
        }

        return every(a, makeCompare(callback), b);
    }

    function makeCompare(callback) {
        return function(value, i) {
            return i in this && callback(value, this[i]);
        };
    }

    module.exports = equals;



},{"../lang/is":170,"../lang/isArray":171,"./every":138}],138:[function(require,module,exports){
var makeIterator = require('../function/makeIterator_');

    /**
     * Array every
     */
    function every(arr, callback, thisObj) {
        callback = makeIterator(callback, thisObj);
        var result = true;
        if (arr == null) {
            return result;
        }

        var i = -1, len = arr.length;
        while (++i < len) {
            // we iterate over sparse items since there is no way to make it
            // work properly on IE 7-8. see #64
            if (!callback(arr[i], i, arr) ) {
                result = false;
                break;
            }
        }

        return result;
    }

    module.exports = every;


},{"../function/makeIterator_":162}],139:[function(require,module,exports){
var makeIterator = require('../function/makeIterator_');

    /**
     * Array filter
     */
    function filter(arr, callback, thisObj) {
        callback = makeIterator(callback, thisObj);
        var results = [];
        if (arr == null) {
            return results;
        }

        var i = -1, len = arr.length, value;
        while (++i < len) {
            value = arr[i];
            if (callback(value, i, arr)) {
                results.push(value);
            }
        }

        return results;
    }

    module.exports = filter;



},{"../function/makeIterator_":162}],140:[function(require,module,exports){
var findIndex = require('./findIndex');

    /**
     * Returns first item that matches criteria
     */
    function find(arr, iterator, thisObj){
        var idx = findIndex(arr, iterator, thisObj);
        return idx >= 0? arr[idx] : void(0);
    }

    module.exports = find;



},{"./findIndex":141}],141:[function(require,module,exports){
var makeIterator = require('../function/makeIterator_');

    /**
     * Returns the index of the first item that matches criteria
     */
    function findIndex(arr, iterator, thisObj){
        iterator = makeIterator(iterator, thisObj);
        if (arr == null) {
            return -1;
        }

        var i = -1, len = arr.length;
        while (++i < len) {
            if (iterator(arr[i], i, arr)) {
                return i;
            }
        }

        return -1;
    }

    module.exports = findIndex;


},{"../function/makeIterator_":162}],142:[function(require,module,exports){
var isArray = require('../lang/isArray');
var append = require('./append');

    /*
     * Helper function to flatten to a destination array.
     * Used to remove the need to create intermediate arrays while flattening.
     */
    function flattenTo(arr, result, level) {
        if (level === 0) {
            append(result, arr);
            return result;
        }

        var value,
            i = -1,
            len = arr.length;
        while (++i < len) {
            value = arr[i];
            if (isArray(value)) {
                flattenTo(value, result, level - 1);
            } else {
                result.push(value);
            }
        }
        return result;
    }

    /**
     * Recursively flattens an array.
     * A new array containing all the elements is returned.
     * If level is specified, it will only flatten up to that level.
     */
    function flatten(arr, level) {
        if (arr == null) {
            return [];
        }

        level = level == null ? -1 : level;
        return flattenTo(arr, [], level);
    }

    module.exports = flatten;




},{"../lang/isArray":171,"./append":133}],143:[function(require,module,exports){
arguments[4][72][0].apply(exports,arguments)
},{"dup":72}],144:[function(require,module,exports){
arguments[4][73][0].apply(exports,arguments)
},{"dup":73}],145:[function(require,module,exports){
var difference = require('./difference');
var slice = require('./slice');

    /**
     * Insert item into array if not already present.
     */
    function insert(arr, rest_items) {
        var diff = difference(slice(arguments, 1), arr);
        if (diff.length) {
            Array.prototype.push.apply(arr, diff);
        }
        return arr.length;
    }
    module.exports = insert;


},{"./difference":136,"./slice":151}],146:[function(require,module,exports){
var unique = require('./unique');
var filter = require('./filter');
var every = require('./every');
var contains = require('./contains');
var slice = require('./slice');


    /**
     * Return a new Array with elements common to all Arrays.
     * - based on underscore.js implementation
     */
    function intersection(arr) {
        var arrs = slice(arguments, 1),
            result = filter(unique(arr), function(needle){
                return every(arrs, function(haystack){
                    return contains(haystack, needle);
                });
            });
        return result;
    }

    module.exports = intersection;



},{"./contains":135,"./every":138,"./filter":139,"./slice":151,"./unique":154}],147:[function(require,module,exports){
var slice = require('./slice');

    /**
     * Call `methodName` on each item of the array passing custom arguments if
     * needed.
     */
    function invoke(arr, methodName, var_args){
        if (arr == null) {
            return arr;
        }

        var args = slice(arguments, 2);
        var i = -1, len = arr.length, value;
        while (++i < len) {
            value = arr[i];
            value[methodName].apply(value, args);
        }

        return arr;
    }

    module.exports = invoke;


},{"./slice":151}],148:[function(require,module,exports){


    /**
     * Returns last element of array.
     */
    function last(arr){
        if (arr == null || arr.length < 1) {
            return undefined;
        }

        return arr[arr.length - 1];
    }

    module.exports = last;



},{}],149:[function(require,module,exports){
var makeIterator = require('../function/makeIterator_');

    /**
     * Array map
     */
    function map(arr, callback, thisObj) {
        callback = makeIterator(callback, thisObj);
        var results = [];
        if (arr == null){
            return results;
        }

        var i = -1, len = arr.length;
        while (++i < len) {
            results[i] = callback(arr[i], i, arr);
        }

        return results;
    }

     module.exports = map;


},{"../function/makeIterator_":162}],150:[function(require,module,exports){
var indexOf = require('./indexOf');

    /**
     * Remove all instances of an item from array.
     */
    function removeAll(arr, item){
        var idx = indexOf(arr, item);
        while (idx !== -1) {
            arr.splice(idx, 1);
            idx = indexOf(arr, item, idx);
        }
    }

    module.exports = removeAll;


},{"./indexOf":144}],151:[function(require,module,exports){


    /**
     * Create slice of source array or array-like object
     */
    function slice(arr, start, end){
        var len = arr.length;

        if (start == null) {
            start = 0;
        } else if (start < 0) {
            start = Math.max(len + start, 0);
        } else {
            start = Math.min(start, len);
        }

        if (end == null) {
            end = len;
        } else if (end < 0) {
            end = Math.max(len + end, 0);
        } else {
            end = Math.min(end, len);
        }

        var result = [];
        while (start < end) {
            result.push(arr[start++]);
        }

        return result;
    }

    module.exports = slice;



},{}],152:[function(require,module,exports){
var makeIterator = require('../function/makeIterator_');

    /**
     * Array some
     */
    function some(arr, callback, thisObj) {
        callback = makeIterator(callback, thisObj);
        var result = false;
        if (arr == null) {
            return result;
        }

        var i = -1, len = arr.length;
        while (++i < len) {
            // we iterate over sparse items since there is no way to make it
            // work properly on IE 7-8. see #64
            if ( callback(arr[i], i, arr) ) {
                result = true;
                break;
            }
        }

        return result;
    }

    module.exports = some;


},{"../function/makeIterator_":162}],153:[function(require,module,exports){


    /**
     * Split array into a fixed number of segments.
     */
    function split(array, segments) {
        segments = segments || 2;
        var results = [];
        if (array == null) {
            return results;
        }

        var minLength = Math.floor(array.length / segments),
            remainder = array.length % segments,
            i = 0,
            len = array.length,
            segmentIndex = 0,
            segmentLength;

        while (i < len) {
            segmentLength = minLength;
            if (segmentIndex < remainder) {
                segmentLength++;
            }

            results.push(array.slice(i, i + segmentLength));

            segmentIndex++;
            i += segmentLength;
        }

        return results;
    }
    module.exports = split;


},{}],154:[function(require,module,exports){
var filter = require('./filter');

    /**
     * @return {array} Array of unique items
     */
    function unique(arr, compare){
        compare = compare || isEqual;
        return filter(arr, function(item, i, arr){
            var n = arr.length;
            while (++i < n) {
                if ( compare(item, arr[i]) ) {
                    return false;
                }
            }
            return true;
        });
    }

    function isEqual(a, b){
        return a === b;
    }

    module.exports = unique;



},{"./filter":139}],155:[function(require,module,exports){
var make = require('./make_');
var arrFind = require('../array/find');
var objFind = require('../object/find');

    /**
     * Find value that returns true on iterator check.
     */
    module.exports = make(arrFind, objFind);



},{"../array/find":140,"../object/find":196,"./make_":157}],156:[function(require,module,exports){
var make = require('./make_');
var arrForEach = require('../array/forEach');
var objForEach = require('../object/forOwn');

    /**
     */
    module.exports = make(arrForEach, objForEach);



},{"../array/forEach":143,"../object/forOwn":198,"./make_":157}],157:[function(require,module,exports){
var slice = require('../array/slice');

    /**
     * internal method used to create other collection modules.
     */
    function makeCollectionMethod(arrMethod, objMethod, defaultReturn) {
        return function(){
            var args = slice(arguments);
            if (args[0] == null) {
                return defaultReturn;
            }
            // array-like is treated as array
            return (typeof args[0].length === 'number')? arrMethod.apply(null, args) : objMethod.apply(null, args);
        };
    }

    module.exports = makeCollectionMethod;



},{"../array/slice":151}],158:[function(require,module,exports){
var isArray = require('../lang/isArray');
var objSize = require('../object/size');

    /**
     * Get collection size
     */
    function size(list) {
        if (!list) {
            return 0;
        }
        if (isArray(list)) {
            return list.length;
        }
        return objSize(list);
    }

    module.exports = size;



},{"../lang/isArray":171,"../object/size":208}],159:[function(require,module,exports){
var slice = require('../array/slice');

    /**
     * Return a function that will execute in the given context, optionally adding any additional supplied parameters to the beginning of the arguments collection.
     * @param {Function} fn  Function.
     * @param {object} context   Execution context.
     * @param {rest} args    Arguments (0...n arguments).
     * @return {Function} Wrapped Function.
     */
    function bind(fn, context, args){
        var argsArr = slice(arguments, 2); //curried args
        return function(){
            return fn.apply(context, argsArr.concat(slice(arguments)));
        };
    }

    module.exports = bind;



},{"../array/slice":151}],160:[function(require,module,exports){


    /**
     * Debounce callback execution
     */
    function debounce(fn, threshold, isAsap){
        var timeout, result;
        function debounced(){
            var args = arguments, context = this;
            function delayed(){
                if (! isAsap) {
                    result = fn.apply(context, args);
                }
                timeout = null;
            }
            if (timeout) {
                clearTimeout(timeout);
            } else if (isAsap) {
                result = fn.apply(context, args);
            }
            timeout = setTimeout(delayed, threshold);
            return result;
        }
        debounced.cancel = function(){
            clearTimeout(timeout);
        };
        return debounced;
    }

    module.exports = debounce;



},{}],161:[function(require,module,exports){


    /**
     * Returns the first argument provided to it.
     */
    function identity(val){
        return val;
    }

    module.exports = identity;



},{}],162:[function(require,module,exports){
var identity = require('./identity');
var prop = require('./prop');
var deepMatches = require('../object/deepMatches');

    /**
     * Converts argument into a valid iterator.
     * Used internally on most array/object/collection methods that receives a
     * callback/iterator providing a shortcut syntax.
     */
    function makeIterator(src, thisObj){
        if (src == null) {
            return identity;
        }
        switch(typeof src) {
            case 'function':
                // function is the first to improve perf (most common case)
                // also avoid using `Function#call` if not needed, which boosts
                // perf a lot in some cases
                return (typeof thisObj !== 'undefined')? function(val, i, arr){
                    return src.call(thisObj, val, i, arr);
                } : src;
            case 'object':
                return function(val){
                    return deepMatches(val, src);
                };
            case 'string':
            case 'number':
                return prop(src);
        }
    }

    module.exports = makeIterator;



},{"../object/deepMatches":193,"./identity":161,"./prop":163}],163:[function(require,module,exports){


    /**
     * Returns a function that gets a property of the passed object
     */
    function prop(name){
        return function(obj){
            return obj[name];
        };
    }

    module.exports = prop;



},{}],164:[function(require,module,exports){


    /**
     * Returns a function that will execute a list of functions in sequence
     * passing the same arguments to each one. (useful for batch processing
     * items during a forEach loop)
     */
    function series(){
        var fns = arguments;
        return function(){
            var i = 0,
                n = fns.length;
            while (i < n) {
                fns[i].apply(this, arguments);
                i += 1;
            }
        };
    }

    module.exports = series;



},{}],165:[function(require,module,exports){


    // Reference to the global context (works on ES3 and ES5-strict mode)
    //jshint -W061, -W064
    module.exports = Function('return this')();



},{}],166:[function(require,module,exports){
var kindOf = require('./kindOf');
var isPlainObject = require('./isPlainObject');
var mixIn = require('../object/mixIn');

    /**
     * Clone native types.
     */
    function clone(val){
        switch (kindOf(val)) {
            case 'Object':
                return cloneObject(val);
            case 'Array':
                return cloneArray(val);
            case 'RegExp':
                return cloneRegExp(val);
            case 'Date':
                return cloneDate(val);
            default:
                return val;
        }
    }

    function cloneObject(source) {
        if (isPlainObject(source)) {
            return mixIn({}, source);
        } else {
            return source;
        }
    }

    function cloneRegExp(r) {
        var flags = '';
        flags += r.multiline ? 'm' : '';
        flags += r.global ? 'g' : '';
        flags += r.ignoreCase ? 'i' : '';
        return new RegExp(r.source, flags);
    }

    function cloneDate(date) {
        return new Date(+date);
    }

    function cloneArray(arr) {
        return arr.slice();
    }

    module.exports = clone;



},{"../object/mixIn":204,"./isPlainObject":177,"./kindOf":180}],167:[function(require,module,exports){
arguments[4][75][0].apply(exports,arguments)
},{"../object/mixIn":204,"dup":75}],168:[function(require,module,exports){
var clone = require('./clone');
var forOwn = require('../object/forOwn');
var kindOf = require('./kindOf');
var isPlainObject = require('./isPlainObject');

    /**
     * Recursively clone native types.
     */
    function deepClone(val, instanceClone) {
        switch ( kindOf(val) ) {
            case 'Object':
                return cloneObject(val, instanceClone);
            case 'Array':
                return cloneArray(val, instanceClone);
            default:
                return clone(val);
        }
    }

    function cloneObject(source, instanceClone) {
        if (isPlainObject(source)) {
            var out = {};
            forOwn(source, function(val, key) {
                this[key] = deepClone(val, instanceClone);
            }, out);
            return out;
        } else if (instanceClone) {
            return instanceClone(source);
        } else {
            return source;
        }
    }

    function cloneArray(arr, instanceClone) {
        var out = [],
            i = -1,
            n = arr.length,
            val;
        while (++i < n) {
            out[i] = deepClone(arr[i], instanceClone);
        }
        return out;
    }

    module.exports = deepClone;




},{"../object/forOwn":198,"./clone":166,"./isPlainObject":177,"./kindOf":180}],169:[function(require,module,exports){
var is = require('./is');
var isObject = require('./isObject');
var isArray = require('./isArray');
var objEquals = require('../object/equals');
var arrEquals = require('../array/equals');

    /**
     * Recursively checks for same properties and values.
     */
    function deepEquals(a, b, callback){
        callback = callback || is;

        var bothObjects = isObject(a) && isObject(b);
        var bothArrays = !bothObjects && isArray(a) && isArray(b);

        if (!bothObjects && !bothArrays) {
            return callback(a, b);
        }

        function compare(a, b){
            return deepEquals(a, b, callback);
        }

        var method = bothObjects ? objEquals : arrEquals;
        return method(a, b, compare);
    }

    module.exports = deepEquals;



},{"../array/equals":137,"../object/equals":194,"./is":170,"./isArray":171,"./isObject":176}],170:[function(require,module,exports){


    /**
     * Check if both arguments are egal.
     */
    function is(x, y){
        // implementation borrowed from harmony:egal spec
        if (x === y) {
          // 0 === -0, but they are not identical
          return x !== 0 || 1 / x === 1 / y;
        }

        // NaN !== NaN, but they are identical.
        // NaNs are the only non-reflexive value, i.e., if x !== x,
        // then x is a NaN.
        // isNaN is broken: it converts its argument to number, so
        // isNaN("foo") => true
        return x !== x && y !== y;
    }

    module.exports = is;



},{}],171:[function(require,module,exports){
arguments[4][76][0].apply(exports,arguments)
},{"./isKind":174,"dup":76}],172:[function(require,module,exports){
var isKind = require('./isKind');
    /**
     */
    function isBoolean(val) {
        return isKind(val, 'Boolean');
    }
    module.exports = isBoolean;


},{"./isKind":174}],173:[function(require,module,exports){
arguments[4][77][0].apply(exports,arguments)
},{"./isKind":174,"dup":77}],174:[function(require,module,exports){
arguments[4][78][0].apply(exports,arguments)
},{"./kindOf":180,"dup":78}],175:[function(require,module,exports){
var isKind = require('./isKind');
    /**
     */
    function isNumber(val) {
        return isKind(val, 'Number');
    }
    module.exports = isNumber;


},{"./isKind":174}],176:[function(require,module,exports){
arguments[4][79][0].apply(exports,arguments)
},{"./isKind":174,"dup":79}],177:[function(require,module,exports){


    /**
     * Checks if the value is created by the `Object` constructor.
     */
    function isPlainObject(value) {
        return (!!value && typeof value === 'object' &&
            value.constructor === Object);
    }

    module.exports = isPlainObject;



},{}],178:[function(require,module,exports){


    /**
     * Checks if the object is a primitive
     */
    function isPrimitive(value) {
        // Using switch fallthrough because it's simple to read and is
        // generally fast: http://jsperf.com/testing-value-is-primitive/5
        switch (typeof value) {
            case "string":
            case "number":
            case "boolean":
                return true;
        }

        return value == null;
    }

    module.exports = isPrimitive;



},{}],179:[function(require,module,exports){
arguments[4][80][0].apply(exports,arguments)
},{"./isKind":174,"dup":80}],180:[function(require,module,exports){
arguments[4][81][0].apply(exports,arguments)
},{"dup":81}],181:[function(require,module,exports){
var kindOf = require('./kindOf');
var GLOBAL = require('./GLOBAL');

    /**
     * Convert array-like object into array
     */
    function toArray(val){
        var ret = [],
            kind = kindOf(val),
            n;

        if (val != null) {
            if ( val.length == null || kind === 'String' || kind === 'Function' || kind === 'RegExp' || val === GLOBAL ) {
                //string, regexp, function have .length but user probably just want
                //to wrap value into an array..
                ret[ret.length] = val;
            } else {
                //window returns true on isObject in IE7 and may have length
                //property. `typeof NodeList` returns `function` on Safari so
                //we can't use it (#58)
                n = val.length;
                while (n--) {
                    ret[n] = val[n];
                }
            }
        }
        return ret;
    }
    module.exports = toArray;


},{"./GLOBAL":165,"./kindOf":180}],182:[function(require,module,exports){
var isArray = require('./isArray');

    /**
     * covert value into number if numeric
     */
    function toNumber(val){
        // numberic values should come first because of -0
        if (typeof val === 'number') return val;
        // we want all falsy values (besides -0) to return zero to avoid
        // headaches
        if (!val) return 0;
        if (typeof val === 'string') return parseFloat(val);
        // arrays are edge cases. `Number([4]) === 4`
        if (isArray(val)) return NaN;
        return Number(val);
    }

    module.exports = toNumber;



},{"./isArray":171}],183:[function(require,module,exports){
arguments[4][82][0].apply(exports,arguments)
},{"dup":82}],184:[function(require,module,exports){

    /**
     * Clamps value inside range.
     */
    function clamp(val, min, max){
        return val < min? min : (val > max? max : val);
    }
    module.exports = clamp;


},{}],185:[function(require,module,exports){

    /**
    * Linear interpolation.
    * IMPORTANT:will return `Infinity` if numbers overflow Number.MAX_VALUE
    */
    function lerp(ratio, start, end){
        return start + (end - start) * ratio;
    }

    module.exports = lerp;


},{}],186:[function(require,module,exports){
var lerp = require('./lerp');
var norm = require('./norm');
    /**
    * Maps a number from one scale to another.
    * @example map(3, 0, 4, -1, 1) -> 0.5
    */
    function map(val, min1, max1, min2, max2){
        return lerp( norm(val, min1, max1), min2, max2 );
    }
    module.exports = map;


},{"./lerp":185,"./norm":187}],187:[function(require,module,exports){

    /**
    * Gets normalized ratio of value inside range.
    */
    function norm(val, min, max){
        if (val < min || val > max) {
            throw new RangeError('value (' + val + ') must be between ' + min + ' and ' + max);
        }

        return val === max ? 1 : (val - min) / (max - min);
    }
    module.exports = norm;


},{}],188:[function(require,module,exports){
/**
 * @constant Maximum 32-bit signed integer value. (2^31 - 1)
 */

    module.exports = 2147483647;


},{}],189:[function(require,module,exports){
/**
 * @constant Minimum 32-bit signed integer value (-2^31).
 */

    module.exports = -2147483648;


},{}],190:[function(require,module,exports){
var toNumber = require('../lang/toNumber');
    /**
     * Enforce a specific amount of decimal digits and also fix floating
     * point rounding issues.
     */
    function enforcePrecision(val, nDecimalDigits){
        val = toNumber(val);
        var pow = Math.pow(10, nDecimalDigits);
        return +(Math.round(val * pow) / pow).toFixed(nDecimalDigits);
    }
    module.exports = enforcePrecision;


},{"../lang/toNumber":182}],191:[function(require,module,exports){


    /**
     * "Convert" value into an 32-bit integer.
     * Works like `Math.floor` if val > 0 and `Math.ceil` if val < 0.
     * IMPORTANT: val will wrap at 2^31 and -2^31.
     * Perf tests: http://jsperf.com/vs-vs-parseint-bitwise-operators/7
     */
    function toInt(val){
        // we do not use lang/toNumber because of perf and also because it
        // doesn't break the functionality
        return ~~val;
    }

    module.exports = toInt;



},{}],192:[function(require,module,exports){
var forOwn = require('./forOwn');
var isPlainObject = require('../lang/isPlainObject');

    /**
     * Deeply copy missing properties in the target from the defaults.
     */
    function deepFillIn(target, defaults){
        var i = 0,
            n = arguments.length,
            obj;

        while(++i < n) {
            obj = arguments[i];
            if (obj) {
                // jshint loopfunc: true
                forOwn(obj, function(newValue, key) {
                    var curValue = target[key];
                    if (curValue == null) {
                        target[key] = newValue;
                    } else if (isPlainObject(curValue) &&
                               isPlainObject(newValue)) {
                        deepFillIn(curValue, newValue);
                    }
                });
            }
        }

        return target;
    }

    module.exports = deepFillIn;



},{"../lang/isPlainObject":177,"./forOwn":198}],193:[function(require,module,exports){
var forOwn = require('./forOwn');
var isArray = require('../lang/isArray');

    function containsMatch(array, pattern) {
        var i = -1, length = array.length;
        while (++i < length) {
            if (deepMatches(array[i], pattern)) {
                return true;
            }
        }

        return false;
    }

    function matchArray(target, pattern) {
        var i = -1, patternLength = pattern.length;
        while (++i < patternLength) {
            if (!containsMatch(target, pattern[i])) {
                return false;
            }
        }

        return true;
    }

    function matchObject(target, pattern) {
        var result = true;
        forOwn(pattern, function(val, key) {
            if (!deepMatches(target[key], val)) {
                // Return false to break out of forOwn early
                return (result = false);
            }
        });

        return result;
    }

    /**
     * Recursively check if the objects match.
     */
    function deepMatches(target, pattern){
        if (target && typeof target === 'object') {
            if (isArray(target) && isArray(pattern)) {
                return matchArray(target, pattern);
            } else {
                return matchObject(target, pattern);
            }
        } else {
            return target === pattern;
        }
    }

    module.exports = deepMatches;



},{"../lang/isArray":171,"./forOwn":198}],194:[function(require,module,exports){
var hasOwn = require('./hasOwn');
var every = require('./every');
var isObject = require('../lang/isObject');
var is = require('../lang/is');

    // Makes a function to compare the object values from the specified compare
    // operation callback.
    function makeCompare(callback) {
        return function(value, key) {
            return hasOwn(this, key) && callback(value, this[key]);
        };
    }

    function checkProperties(value, key) {
        return hasOwn(this, key);
    }

    /**
     * Checks if two objects have the same keys and values.
     */
    function equals(a, b, callback) {
        callback = callback || is;

        if (!isObject(a) || !isObject(b)) {
            return callback(a, b);
        }

        return (every(a, makeCompare(callback), b) &&
                every(b, checkProperties, a));
    }

    module.exports = equals;


},{"../lang/is":170,"../lang/isObject":176,"./every":195,"./hasOwn":201}],195:[function(require,module,exports){
var forOwn = require('./forOwn');
var makeIterator = require('../function/makeIterator_');

    /**
     * Object every
     */
    function every(obj, callback, thisObj) {
        callback = makeIterator(callback, thisObj);
        var result = true;
        forOwn(obj, function(val, key) {
            // we consider any falsy values as "false" on purpose so shorthand
            // syntax can be used to check property existence
            if (!callback(val, key, obj)) {
                result = false;
                return false; // break
            }
        });
        return result;
    }

    module.exports = every;



},{"../function/makeIterator_":162,"./forOwn":198}],196:[function(require,module,exports){
var some = require('./some');
var makeIterator = require('../function/makeIterator_');

    /**
     * Returns first item that matches criteria
     */
    function find(obj, callback, thisObj) {
        callback = makeIterator(callback, thisObj);
        var result;
        some(obj, function(value, key, obj) {
            if (callback(value, key, obj)) {
                result = value;
                return true; //break
            }
        });
        return result;
    }

    module.exports = find;



},{"../function/makeIterator_":162,"./some":209}],197:[function(require,module,exports){
arguments[4][83][0].apply(exports,arguments)
},{"./hasOwn":201,"dup":83}],198:[function(require,module,exports){
arguments[4][84][0].apply(exports,arguments)
},{"./forIn":197,"./hasOwn":201,"dup":84}],199:[function(require,module,exports){
var isPrimitive = require('../lang/isPrimitive');

    /**
     * get "nested" object property
     */
    function get(obj, prop){
        var parts = prop.split('.'),
            last = parts.pop();

        while (prop = parts.shift()) {
            obj = obj[prop];
            if (obj == null) return;
        }

        return obj[last];
    }

    module.exports = get;



},{"../lang/isPrimitive":178}],200:[function(require,module,exports){
var get = require('./get');

    var UNDEF;

    /**
     * Check if object has nested property.
     */
    function has(obj, prop){
        return get(obj, prop) !== UNDEF;
    }

    module.exports = has;




},{"./get":199}],201:[function(require,module,exports){
arguments[4][85][0].apply(exports,arguments)
},{"dup":85}],202:[function(require,module,exports){
var forOwn = require('./forOwn');

    /**
     * Get object keys
     */
     var keys = Object.keys || function (obj) {
            var keys = [];
            forOwn(obj, function(val, key){
                keys.push(key);
            });
            return keys;
        };

    module.exports = keys;



},{"./forOwn":198}],203:[function(require,module,exports){
var hasOwn = require('./hasOwn');
var deepClone = require('../lang/deepClone');
var isObject = require('../lang/isObject');

    /**
     * Deep merge objects.
     */
    function merge() {
        var i = 1,
            key, val, obj, target;

        // make sure we don't modify source element and it's properties
        // objects are passed by reference
        target = deepClone( arguments[0] );

        while (obj = arguments[i++]) {
            for (key in obj) {
                if ( ! hasOwn(obj, key) ) {
                    continue;
                }

                val = obj[key];

                if ( isObject(val) && isObject(target[key]) ){
                    // inception, deep merge objects
                    target[key] = merge(target[key], val);
                } else {
                    // make sure arrays, regexp, date, objects are cloned
                    target[key] = deepClone(val);
                }

            }
        }

        return target;
    }

    module.exports = merge;



},{"../lang/deepClone":168,"../lang/isObject":176,"./hasOwn":201}],204:[function(require,module,exports){
arguments[4][86][0].apply(exports,arguments)
},{"./forOwn":198,"dup":86}],205:[function(require,module,exports){
var forEach = require('../array/forEach');

    /**
     * Create nested object if non-existent
     */
    function namespace(obj, path){
        if (!path) return obj;
        forEach(path.split('.'), function(key){
            if (!obj[key]) {
                obj[key] = {};
            }
            obj = obj[key];
        });
        return obj;
    }

    module.exports = namespace;



},{"../array/forEach":143}],206:[function(require,module,exports){
var slice = require('../array/slice');
var contains = require('../array/contains');

    /**
     * Return a copy of the object, filtered to only contain properties except the blacklisted keys.
     */
    function omit(obj, var_keys){
        var keys = typeof arguments[1] !== 'string'? arguments[1] : slice(arguments, 1),
            out = {};

        for (var property in obj) {
            if (obj.hasOwnProperty(property) && !contains(keys, property)) {
                out[property] = obj[property];
            }
        }
        return out;
    }

    module.exports = omit;



},{"../array/contains":135,"../array/slice":151}],207:[function(require,module,exports){
var namespace = require('./namespace');

    /**
     * set "nested" object property
     */
    function set(obj, prop, val){
        var parts = (/^(.+)\.(.+)$/).exec(prop);
        if (parts){
            namespace(obj, parts[1])[parts[2]] = val;
        } else {
            obj[prop] = val;
        }
    }

    module.exports = set;



},{"./namespace":205}],208:[function(require,module,exports){
var forOwn = require('./forOwn');

    /**
     * Get object size
     */
    function size(obj) {
        var count = 0;
        forOwn(obj, function(){
            count++;
        });
        return count;
    }

    module.exports = size;



},{"./forOwn":198}],209:[function(require,module,exports){
var forOwn = require('./forOwn');
var makeIterator = require('../function/makeIterator_');

    /**
     * Object some
     */
    function some(obj, callback, thisObj) {
        callback = makeIterator(callback, thisObj);
        var result = false;
        forOwn(obj, function(val, key) {
            if (callback(val, key, obj)) {
                result = true;
                return false; // break
            }
        });
        return result;
    }

    module.exports = some;



},{"../function/makeIterator_":162,"./forOwn":198}],210:[function(require,module,exports){
var has = require('./has');

    /**
     * Unset object property.
     */
    function unset(obj, prop){
        if (has(obj, prop)) {
            var parts = prop.split('.'),
                last = parts.pop();
            while (prop = parts.shift()) {
                obj = obj[prop];
            }
            return (delete obj[last]);

        } else {
            // if property doesn't exist treat as deleted
            return true;
        }
    }

    module.exports = unset;



},{"./has":200}],211:[function(require,module,exports){
var forOwn = require('./forOwn');

    /**
     * Get object values
     */
    function values(obj) {
        var vals = [];
        forOwn(obj, function(val, key){
            vals.push(val);
        });
        return vals;
    }

    module.exports = values;



},{"./forOwn":198}],212:[function(require,module,exports){
var forOwn = require('../object/forOwn');
var isArray = require('../lang/isArray');
var forEach = require('../array/forEach');

    /**
     * Encode object into a query string.
     */
    function encode(obj){
        var query = [],
            arrValues, reg;
        forOwn(obj, function (val, key) {
            if (isArray(val)) {
                arrValues = key + '=';
                reg = new RegExp('&'+key+'+=$');
                forEach(val, function (aValue) {
                    arrValues += encodeURIComponent(aValue) + '&' + key + '=';
                });
                query.push(arrValues.replace(reg, ''));
            } else {
               query.push(key + '=' + encodeURIComponent(val));
            }
        });
        return (query.length) ? '?' + query.join('&') : '';
    }

    module.exports = encode;


},{"../array/forEach":143,"../lang/isArray":171,"../object/forOwn":198}],213:[function(require,module,exports){
var typecast = require('../string/typecast');
var getQuery = require('./getQuery');

    /**
     * Get query parameter value.
     */
    function getParam(url, param, shouldTypecast){
        var regexp = new RegExp('(\\?|&)'+ param + '=([^&]*)'), //matches `?param=value` or `&param=value`, value = $2
            result = regexp.exec( getQuery(url) ),
            val = (result && result[2])? result[2] : null;
        return shouldTypecast === false? val : typecast(val);
    }

    module.exports = getParam;


},{"../string/typecast":238,"./getQuery":214}],214:[function(require,module,exports){


    /**
     * Gets full query as string with all special chars decoded.
     */
    function getQuery(url) {
        url = url.replace(/#.*/, ''); //removes hash (to avoid getting hash query)
        var queryString = /\?[a-zA-Z0-9\=\&\%\$\-\_\.\+\!\*\'\(\)\,]+/.exec(url); //valid chars according to: http://www.ietf.org/rfc/rfc1738.txt
        return (queryString)? decodeURIComponent(queryString[0].replace(/\+/g,' ')) : '';
    }

    module.exports = getQuery;


},{}],215:[function(require,module,exports){


    /**
     * Set query string parameter value
     */
    function setParam(url, paramName, value){
        url = url || '';

        var re = new RegExp('(\\?|&)'+ paramName +'=[^&]*' );
        var param = paramName +'='+ encodeURIComponent( value );

        if ( re.test(url) ) {
            return url.replace(re, '$1'+ param);
        } else {
            if (url.indexOf('?') === -1) {
                url += '?';
            }
            if (url.indexOf('=') !== -1) {
                url += '&';
            }
            return url + param;
        }

    }

    module.exports = setParam;



},{}],216:[function(require,module,exports){
var randInt = require('./randInt');
var isArray = require('../lang/isArray');

    /**
     * Returns a random element from the supplied arguments
     * or from the array (if single argument is an array).
     */
    function choice(items) {
        var target = (arguments.length === 1 && isArray(items))? items : arguments;
        return target[ randInt(0, target.length - 1) ];
    }

    module.exports = choice;



},{"../lang/isArray":171,"./randInt":220}],217:[function(require,module,exports){
var randHex = require('./randHex');
var choice = require('./choice');

  /**
   * Returns pseudo-random guid (UUID v4)
   * IMPORTANT: it's not totally "safe" since randHex/choice uses Math.random
   * by default and sequences can be predicted in some cases. See the
   * "random/random" documentation for more info about it and how to replace
   * the default PRNG.
   */
  function guid() {
    return (
        randHex(8)+'-'+
        randHex(4)+'-'+
        // v4 UUID always contain "4" at this position to specify it was
        // randomly generated
        '4' + randHex(3) +'-'+
        // v4 UUID always contain chars [a,b,8,9] at this position
        choice(8, 9, 'a', 'b') + randHex(3)+'-'+
        randHex(12)
    );
  }
  module.exports = guid;


},{"./choice":216,"./randHex":219}],218:[function(require,module,exports){
var random = require('./random');
var MIN_INT = require('../number/MIN_INT');
var MAX_INT = require('../number/MAX_INT');

    /**
     * Returns random number inside range
     */
    function rand(min, max){
        min = min == null? MIN_INT : min;
        max = max == null? MAX_INT : max;
        return min + (max - min) * random();
    }

    module.exports = rand;


},{"../number/MAX_INT":188,"../number/MIN_INT":189,"./random":221}],219:[function(require,module,exports){
var choice = require('./choice');

    var _chars = '0123456789abcdef'.split('');

    /**
     * Returns a random hexadecimal string
     */
    function randHex(size){
        size = size && size > 0? size : 6;
        var str = '';
        while (size--) {
            str += choice(_chars);
        }
        return str;
    }

    module.exports = randHex;



},{"./choice":216}],220:[function(require,module,exports){
var MIN_INT = require('../number/MIN_INT');
var MAX_INT = require('../number/MAX_INT');
var rand = require('./rand');

    /**
     * Gets random integer inside range or snap to min/max values.
     */
    function randInt(min, max){
        min = min == null? MIN_INT : ~~min;
        max = max == null? MAX_INT : ~~max;
        // can't be max + 0.5 otherwise it will round up if `rand`
        // returns `max` causing it to overflow range.
        // -0.5 and + 0.49 are required to avoid bias caused by rounding
        return Math.round( rand(min - 0.5, max + 0.499999999999) );
    }

    module.exports = randInt;


},{"../number/MAX_INT":188,"../number/MIN_INT":189,"./rand":218}],221:[function(require,module,exports){


    /**
     * Just a wrapper to Math.random. No methods inside mout/random should call
     * Math.random() directly so we can inject the pseudo-random number
     * generator if needed (ie. in case we need a seeded random or a better
     * algorithm than the native one)
     */
    function random(){
        return random.get();
    }

    // we expose the method so it can be swapped if needed
    random.get = Math.random;

    module.exports = random;



},{}],222:[function(require,module,exports){
arguments[4][87][0].apply(exports,arguments)
},{"dup":87}],223:[function(require,module,exports){
var toString = require('../lang/toString');

    /**
     * Searches for a given substring
     */
    function contains(str, substring, fromIndex){
        str = toString(str);
        substring = toString(substring);
        return str.indexOf(substring, fromIndex) !== -1;
    }

    module.exports = contains;



},{"../lang/toString":183}],224:[function(require,module,exports){
var toString = require('../lang/toString');

    /**
     * Escapes a string for insertion into HTML.
     */
    function escapeHtml(str){
        str = toString(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#39;')
            .replace(/"/g, '&quot;');
        return str;
    }

    module.exports = escapeHtml;



},{"../lang/toString":183}],225:[function(require,module,exports){
var toString = require('../lang/toString');

    /**
     * Escape string into unicode sequences
     */
    function escapeUnicode(str, shouldEscapePrintable){
        str = toString(str);
        return str.replace(/[\s\S]/g, function(ch){
            // skip printable ASCII chars if we should not escape them
            if (!shouldEscapePrintable && (/[\x20-\x7E]/).test(ch)) {
                return ch;
            }
            // we use "000" and slice(-4) for brevity, need to pad zeros,
            // unicode escape always have 4 chars after "\u"
            return '\\u'+ ('000'+ ch.charCodeAt(0).toString(16)).slice(-4);
        });
    }

    module.exports = escapeUnicode;



},{"../lang/toString":183}],226:[function(require,module,exports){
var toString = require('../lang/toString');
var get = require('../object/get');

    var stache = /\{\{([^\}]+)\}\}/g; //mustache-like

    /**
     * String interpolation
     */
    function interpolate(template, replacements, syntax){
        template = toString(template);
        var replaceFn = function(match, prop){
            return toString( get(replacements, prop) );
        };
        return template.replace(syntax || stache, replaceFn);
    }

    module.exports = interpolate;



},{"../lang/toString":183,"../object/get":199}],227:[function(require,module,exports){
var toString = require('../lang/toString');
    /**
     * "Safer" String.toLowerCase()
     */
    function lowerCase(str){
        str = toString(str);
        return str.toLowerCase();
    }

    module.exports = lowerCase;


},{"../lang/toString":183}],228:[function(require,module,exports){
arguments[4][88][0].apply(exports,arguments)
},{"../lang/toString":183,"./WHITE_SPACES":222,"dup":88}],229:[function(require,module,exports){
var toString = require('../lang/toString');
var lowerCase = require('./lowerCase');
var upperCase = require('./upperCase');
    /**
     * UPPERCASE first char of each word.
     */
    function properCase(str){
        str = toString(str);
        return lowerCase(str).replace(/^\w|\s\w/g, upperCase);
    }

    module.exports = properCase;


},{"../lang/toString":183,"./lowerCase":227,"./upperCase":241}],230:[function(require,module,exports){
var toString = require('../lang/toString');
    // This pattern is generated by the _build/pattern-removeNonWord.js script
    var PATTERN = /[^\x20\x2D0-9A-Z\x5Fa-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]/g;

    /**
     * Remove non-word chars.
     */
    function removeNonWord(str){
        str = toString(str);
        return str.replace(PATTERN, '');
    }

    module.exports = removeNonWord;


},{"../lang/toString":183}],231:[function(require,module,exports){
var toString = require('../lang/toString');
var toInt = require('../number/toInt');

    /**
     * Repeat string n times
     */
     function repeat(str, n){
         var result = '';
         str = toString(str);
         n = toInt(n);
        if (n < 1) {
            return '';
        }
        while (n > 0) {
            if (n % 2) {
                result += str;
            }
            n = Math.floor(n / 2);
            str += str;
        }
        return result;
     }

     module.exports = repeat;



},{"../lang/toString":183,"../number/toInt":191}],232:[function(require,module,exports){
var toString = require('../lang/toString');
var toArray = require('../lang/toArray');

    /**
     * Replace string(s) with the replacement(s) in the source.
     */
    function replace(str, search, replacements) {
        str = toString(str);
        search = toArray(search);
        replacements = toArray(replacements);

        var searchLength = search.length,
            replacementsLength = replacements.length;

        if (replacementsLength !== 1 && searchLength !== replacementsLength) {
            throw new Error('Unequal number of searches and replacements');
        }

        var i = -1;
        while (++i < searchLength) {
            // Use the first replacement for all searches if only one
            // replacement is provided
            str = str.replace(
                search[i],
                replacements[(replacementsLength === 1) ? 0 : i]);
        }

        return str;
    }

    module.exports = replace;



},{"../lang/toArray":181,"../lang/toString":183}],233:[function(require,module,exports){
var toString = require('../lang/toString');
    /**
    * Replaces all accented chars with regular ones
    */
    function replaceAccents(str){
        str = toString(str);

        // verifies if the String has accents and replace them
        if (str.search(/[\xC0-\xFF]/g) > -1) {
            str = str
                    .replace(/[\xC0-\xC5]/g, "A")
                    .replace(/[\xC6]/g, "AE")
                    .replace(/[\xC7]/g, "C")
                    .replace(/[\xC8-\xCB]/g, "E")
                    .replace(/[\xCC-\xCF]/g, "I")
                    .replace(/[\xD0]/g, "D")
                    .replace(/[\xD1]/g, "N")
                    .replace(/[\xD2-\xD6\xD8]/g, "O")
                    .replace(/[\xD9-\xDC]/g, "U")
                    .replace(/[\xDD]/g, "Y")
                    .replace(/[\xDE]/g, "P")
                    .replace(/[\xE0-\xE5]/g, "a")
                    .replace(/[\xE6]/g, "ae")
                    .replace(/[\xE7]/g, "c")
                    .replace(/[\xE8-\xEB]/g, "e")
                    .replace(/[\xEC-\xEF]/g, "i")
                    .replace(/[\xF1]/g, "n")
                    .replace(/[\xF2-\xF6\xF8]/g, "o")
                    .replace(/[\xF9-\xFC]/g, "u")
                    .replace(/[\xFE]/g, "p")
                    .replace(/[\xFD\xFF]/g, "y");
        }
        return str;
    }
    module.exports = replaceAccents;


},{"../lang/toString":183}],234:[function(require,module,exports){
var toString = require('../lang/toString');
var repeat = require('./repeat');

    /**
     * Pad string with `char` if its' length is smaller than `minLen`
     */
    function rpad(str, minLen, ch) {
        str = toString(str);
        ch = ch || ' ';
        return (str.length < minLen)? str + repeat(ch, minLen - str.length) : str;
    }

    module.exports = rpad;



},{"../lang/toString":183,"./repeat":231}],235:[function(require,module,exports){
arguments[4][89][0].apply(exports,arguments)
},{"../lang/toString":183,"./WHITE_SPACES":222,"dup":89}],236:[function(require,module,exports){
var toString = require('../lang/toString');
var replaceAccents = require('./replaceAccents');
var removeNonWord = require('./removeNonWord');
var trim = require('./trim');
    /**
     * Convert to lower case, remove accents, remove non-word chars and
     * replace spaces with the specified delimeter.
     * Does not split camelCase text.
     */
    function slugify(str, delimeter){
        str = toString(str);

        if (delimeter == null) {
            delimeter = "-";
        }
        str = replaceAccents(str);
        str = removeNonWord(str);
        str = trim(str) //should come after removeNonWord
                .replace(/ +/g, delimeter) //replace spaces with delimeter
                .toLowerCase();
        return str;
    }
    module.exports = slugify;


},{"../lang/toString":183,"./removeNonWord":230,"./replaceAccents":233,"./trim":237}],237:[function(require,module,exports){
arguments[4][90][0].apply(exports,arguments)
},{"../lang/toString":183,"./WHITE_SPACES":222,"./ltrim":228,"./rtrim":235,"dup":90}],238:[function(require,module,exports){


    var UNDEF;

    /**
     * Parses string and convert it into a native value.
     */
    function typecast(val) {
        var r;
        if ( val === null || val === 'null' ) {
            r = null;
        } else if ( val === 'true' ) {
            r = true;
        } else if ( val === 'false' ) {
            r = false;
        } else if ( val === UNDEF || val === 'undefined' ) {
            r = UNDEF;
        } else if ( val === '' || isNaN(val) ) {
            //isNaN('') returns false
            r = val;
        } else {
            //parseFloat(null || '') returns NaN
            r = parseFloat(val);
        }
        return r;
    }

    module.exports = typecast;


},{}],239:[function(require,module,exports){
var toString = require('../lang/toString');

    /**
     * Unescapes HTML special chars
     */
    function unescapeHtml(str){
        str = toString(str)
            .replace(/&amp;/g , '&')
            .replace(/&lt;/g  , '<')
            .replace(/&gt;/g  , '>')
            .replace(/&#0*39;/g , "'")
            .replace(/&quot;/g, '"');
        return str;
    }

    module.exports = unescapeHtml;



},{"../lang/toString":183}],240:[function(require,module,exports){
var toString = require('../lang/toString');
    /**
     * Replaces hyphens with spaces. (only hyphens between word chars)
     */
    function unhyphenate(str){
        str = toString(str);
        return str.replace(/(\w)(-)(\w)/g, '$1 $3');
    }
    module.exports = unhyphenate;


},{"../lang/toString":183}],241:[function(require,module,exports){
arguments[4][91][0].apply(exports,arguments)
},{"../lang/toString":183,"dup":91}],242:[function(require,module,exports){
arguments[4][92][0].apply(exports,arguments)
},{"dup":92}],243:[function(require,module,exports){
arguments[4][151][0].apply(exports,arguments)
},{"dup":151}],244:[function(require,module,exports){
arguments[4][159][0].apply(exports,arguments)
},{"../array/slice":243,"dup":159}],245:[function(require,module,exports){
var kindOf = require('./kindOf');
var isPlainObject = require('./isPlainObject');
var mixIn = require('../object/mixIn');

    /**
     * Clone native types.
     */
    function clone(val){
        switch (kindOf(val)) {
            case 'Object':
                return cloneObject(val);
            case 'Array':
                return cloneArray(val);
            case 'RegExp':
                return cloneRegExp(val);
            case 'Date':
                return cloneDate(val);
            default:
                return val;
        }
    }

    function cloneObject(source) {
        if (isPlainObject(source)) {
            return mixIn({}, source);
        } else {
            return source;
        }
    }

    function cloneRegExp(r) {
        var flags = '';
        flags += r.multiline ? 'm' : '';
        flags += r.global ? 'g' : '';
        flags += r.ignorecase ? 'i' : '';
        return new RegExp(r.source, flags);
    }

    function cloneDate(date) {
        return new Date(+date);
    }

    function cloneArray(arr) {
        return arr.slice();
    }

    module.exports = clone;



},{"../object/mixIn":255,"./isPlainObject":249,"./kindOf":250}],246:[function(require,module,exports){
arguments[4][168][0].apply(exports,arguments)
},{"../object/forOwn":252,"./clone":245,"./isPlainObject":249,"./kindOf":250,"dup":168}],247:[function(require,module,exports){
arguments[4][78][0].apply(exports,arguments)
},{"./kindOf":250,"dup":78}],248:[function(require,module,exports){
arguments[4][79][0].apply(exports,arguments)
},{"./isKind":247,"dup":79}],249:[function(require,module,exports){
arguments[4][177][0].apply(exports,arguments)
},{"dup":177}],250:[function(require,module,exports){
arguments[4][81][0].apply(exports,arguments)
},{"dup":81}],251:[function(require,module,exports){
arguments[4][83][0].apply(exports,arguments)
},{"./hasOwn":253,"dup":83}],252:[function(require,module,exports){
arguments[4][84][0].apply(exports,arguments)
},{"./forIn":251,"./hasOwn":253,"dup":84}],253:[function(require,module,exports){
arguments[4][85][0].apply(exports,arguments)
},{"dup":85}],254:[function(require,module,exports){
arguments[4][203][0].apply(exports,arguments)
},{"../lang/deepClone":246,"../lang/isObject":248,"./hasOwn":253,"dup":203}],255:[function(require,module,exports){
arguments[4][86][0].apply(exports,arguments)
},{"./forOwn":252,"dup":86}],256:[function(require,module,exports){
arguments[4][95][0].apply(exports,arguments)
},{"dup":95,"mout/lang/createObject":257,"mout/lang/kindOf":258,"mout/object/hasOwn":261,"mout/object/mixIn":262}],257:[function(require,module,exports){
arguments[4][75][0].apply(exports,arguments)
},{"../object/mixIn":262,"dup":75}],258:[function(require,module,exports){
arguments[4][81][0].apply(exports,arguments)
},{"dup":81}],259:[function(require,module,exports){
arguments[4][83][0].apply(exports,arguments)
},{"./hasOwn":261,"dup":83}],260:[function(require,module,exports){
arguments[4][84][0].apply(exports,arguments)
},{"./forIn":259,"./hasOwn":261,"dup":84}],261:[function(require,module,exports){
arguments[4][85][0].apply(exports,arguments)
},{"dup":85}],262:[function(require,module,exports){
arguments[4][86][0].apply(exports,arguments)
},{"./forOwn":260,"dup":86}],263:[function(require,module,exports){
"use strict";

// credits to @cpojer's Class.Binds, released under the MIT license
// https://github.com/cpojer/mootools-class-extras/blob/master/Source/Class.Binds.js

var prime = require("prime")
var bind = require("mout/function/bind")

var bound = prime({

    bound: function(name){
        var bound = this._bound || (this._bound = {})
        return bound[name] || (bound[name] = bind(this[name], this))
    }

})

module.exports = bound

},{"mout/function/bind":244,"prime":256}],264:[function(require,module,exports){
"use strict";

var prime = require("prime")
var merge = require("mout/object/merge")

var Options = prime({

    setOptions: function(options){
        var args = [{}, this.options]
        args.push.apply(args, arguments)
        this.options = merge.apply(null, args)
        return this
    }

})

module.exports = Options

},{"mout/object/merge":254,"prime":256}],265:[function(require,module,exports){
(function (process,global){
/*
defer
*/"use strict"

var kindOf  = require("mout/lang/kindOf"),
    now     = require("mout/time/now"),
    forEach = require("mout/array/forEach"),
    indexOf = require("mout/array/indexOf")

var callbacks = {
    timeout: {},
    frame: [],
    immediate: []
}

var push = function(collection, callback, context, defer){

    var iterator = function(){
        iterate(collection)
    }

    if (!collection.length) defer(iterator)

    var entry = {
        callback: callback,
        context: context
    }

    collection.push(entry)

    return function(){
        var io = indexOf(collection, entry)
        if (io > -1) collection.splice(io, 1)
    }
}

var iterate = function(collection){
    var time = now()

    forEach(collection.splice(0), function(entry) {
        entry.callback.call(entry.context, time)
    })
}

var defer = function(callback, argument, context){
    return (kindOf(argument) === "Number") ? defer.timeout(callback, argument, context) : defer.immediate(callback, argument)
}

if (global.process && process.nextTick){

    defer.immediate = function(callback, context){
        return push(callbacks.immediate, callback, context, process.nextTick)
    }

} else if (global.setImmediate){

    defer.immediate = function(callback, context){
        return push(callbacks.immediate, callback, context, setImmediate)
    }

} else if (global.postMessage && global.addEventListener){

    addEventListener("message", function(event){
        if (event.source === global && event.data === "@deferred"){
            event.stopPropagation()
            iterate(callbacks.immediate)
        }
    }, true)

    defer.immediate = function(callback, context){
        return push(callbacks.immediate, callback, context, function(){
            postMessage("@deferred", "*")
        })
    }

} else {

    defer.immediate = function(callback, context){
        return push(callbacks.immediate, callback, context, function(iterator){
            setTimeout(iterator, 0)
        })
    }

}

var requestAnimationFrame = global.requestAnimationFrame ||
    global.webkitRequestAnimationFrame ||
    global.mozRequestAnimationFrame ||
    global.oRequestAnimationFrame ||
    global.msRequestAnimationFrame ||
    function(callback) {
        setTimeout(callback, 1e3 / 60)
    }

defer.frame = function(callback, context){
    return push(callbacks.frame, callback, context, requestAnimationFrame)
}

var clear

defer.timeout = function(callback, ms, context){
    var ct = callbacks.timeout

    if (!clear) clear = defer.immediate(function(){
        clear = null
        callbacks.timeout = {}
    })

    return push(ct[ms] || (ct[ms] = []), callback, context, function(iterator){
        setTimeout(iterator, ms)
    })
}

module.exports = defer

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":1,"mout/array/forEach":143,"mout/array/indexOf":144,"mout/lang/kindOf":180,"mout/time/now":242}],266:[function(require,module,exports){
/*
Emitter
*/"use strict"

var indexOf = require("mout/array/indexOf"),
    forEach = require("mout/array/forEach")

var prime = require("./index"),
    defer = require("./defer")

var slice = Array.prototype.slice;

var Emitter = prime({

    constructor: function(stoppable){
        this._stoppable = stoppable
    },

    on: function(event, fn){
        var listeners = this._listeners || (this._listeners = {}),
            events = listeners[event] || (listeners[event] = [])

        if (indexOf(events, fn) === -1) events.push(fn)

        return this
    },

    off: function(event, fn){
        var listeners = this._listeners, events
        if (listeners && (events = listeners[event])){

            var io = indexOf(events, fn)
            if (io > -1) events.splice(io, 1)
            if (!events.length) delete listeners[event];
            for (var l in listeners) return this
            delete this._listeners
        }
        return this
    },

    emit: function(event){
        var self = this,
            args = slice.call(arguments, 1)

        var emit = function(){
            var listeners = self._listeners, events
            if (listeners && (events = listeners[event])){
                forEach(events.slice(0), function(event){
                    var result = event.apply(self, args)
                    if (self._stoppable) return result
                })
            }
        }

        if (args[args.length - 1] === Emitter.EMIT_SYNC){
            args.pop()
            emit()
        } else {
            defer(emit)
        }

        return this
    }

})

Emitter.EMIT_SYNC = {}

module.exports = Emitter

},{"./defer":265,"./index":267,"mout/array/forEach":143,"mout/array/indexOf":144}],267:[function(require,module,exports){
/*
prime
 - prototypal inheritance
*/"use strict"

var hasOwn = require("mout/object/hasOwn"),
    mixIn  = require("mout/object/mixIn"),
    create = require("mout/lang/createObject"),
    kindOf = require("mout/lang/kindOf")

var hasDescriptors = true

try {
    Object.defineProperty({}, "~", {})
    Object.getOwnPropertyDescriptor({}, "~")
} catch (e){
    hasDescriptors = false
}

// we only need to be able to implement "toString" and "valueOf" in IE < 9
var hasEnumBug = !({valueOf: 0}).propertyIsEnumerable("valueOf"),
    buggy      = ["toString", "valueOf"]

var verbs = /^constructor|inherits|mixin$/

var implement = function(proto){
    var prototype = this.prototype

    for (var key in proto){
        if (key.match(verbs)) continue
        if (hasDescriptors){
            var descriptor = Object.getOwnPropertyDescriptor(proto, key)
            if (descriptor){
                Object.defineProperty(prototype, key, descriptor)
                continue
            }
        }
        prototype[key] = proto[key]
    }

    if (hasEnumBug) for (var i = 0; (key = buggy[i]); i++){
        var value = proto[key]
        if (value !== Object.prototype[key]) prototype[key] = value
    }

    return this
}

var prime = function(proto){

    if (kindOf(proto) === "Function") proto = {constructor: proto}

    var superprime = proto.inherits

    // if our nice proto object has no own constructor property
    // then we proceed using a ghosting constructor that all it does is
    // call the parent's constructor if it has a superprime, else an empty constructor
    // proto.constructor becomes the effective constructor
    var constructor = (hasOwn(proto, "constructor")) ? proto.constructor : (superprime) ? function(){
        return superprime.apply(this, arguments)
    } : function(){}

    if (superprime){

        mixIn(constructor, superprime)

        var superproto = superprime.prototype
        // inherit from superprime
        var cproto = constructor.prototype = create(superproto)

        // setting constructor.parent to superprime.prototype
        // because it's the shortest possible absolute reference
        constructor.parent = superproto
        cproto.constructor = constructor
    }

    if (!constructor.implement) constructor.implement = implement

    var mixins = proto.mixin
    if (mixins){
        if (kindOf(mixins) !== "Array") mixins = [mixins]
        for (var i = 0; i < mixins.length; i++) constructor.implement(create(mixins[i].prototype))
    }

    // implement proto and return constructor
    return constructor.implement(proto)

}

module.exports = prime

},{"mout/lang/createObject":167,"mout/lang/kindOf":180,"mout/object/hasOwn":201,"mout/object/mixIn":204}],268:[function(require,module,exports){
/*
Map
*/"use strict"

var indexOf = require("mout/array/indexOf")

var prime = require("./index")

var Map = prime({

    constructor: function Map(){
        this.length = 0
        this._values = []
        this._keys = []
    },

    set: function(key, value){
        var index = indexOf(this._keys, key)

        if (index === -1){
            this._keys.push(key)
            this._values.push(value)
            this.length++
        } else {
            this._values[index] = value
        }

        return this
    },

    get: function(key){
        var index = indexOf(this._keys, key)
        return (index === -1) ? null : this._values[index]
    },

    count: function(){
        return this.length
    },

    forEach: function(method, context){
        for (var i = 0, l = this.length; i < l; i++){
            if (method.call(context, this._values[i], this._keys[i], this) === false) break
        }
        return this
    },

    map: function(method, context){
        var results = new Map
        this.forEach(function(value, key){
            results.set(key, method.call(context, value, key, this))
        }, this)
        return results
    },

    filter: function(method, context){
        var results = new Map
        this.forEach(function(value, key){
            if (method.call(context, value, key, this)) results.set(key, value)
        }, this)
        return results
    },

    every: function(method, context){
        var every = true
        this.forEach(function(value, key){
            if (!method.call(context, value, key, this)) return (every = false)
        }, this)
        return every
    },

    some: function(method, context){
        var some = false
        this.forEach(function(value, key){
            if (method.call(context, value, key, this)) return !(some = true)
        }, this)
        return some
    },

    indexOf: function(value){
        var index = indexOf(this._values, value)
        return (index > -1) ? this._keys[index] : null
    },

    remove: function(value){
        var index = indexOf(this._values, value)

        if (index !== -1){
            this._values.splice(index, 1)
            this.length--
            return this._keys.splice(index, 1)[0]
        }

        return null
    },

    unset: function(key){
        var index = indexOf(this._keys, key)

        if (index !== -1){
            this._keys.splice(index, 1)
            this.length--
            return this._values.splice(index, 1)[0]
        }

        return null
    },

    keys: function(){
        return this._keys.slice()
    },

    values: function(){
        return this._values.slice()
    }

})

var map = function(){
    return new Map
}

map.prototype = Map.prototype

module.exports = map

},{"./index":267,"mout/array/indexOf":144}],269:[function(require,module,exports){
/**
 * sifter.js
 * Copyright (c) 2013 Brian Reavis & contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 * file except in compliance with the License. You may obtain a copy of the License at:
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 * @author Brian Reavis <brian@thirdroute.com>
 */

(function(root, factory) {
	if (typeof define === 'function' && define.amd) {
		define(factory);
	} else if (typeof exports === 'object') {
		module.exports = factory();
	} else {
		root.Sifter = factory();
	}
}(this, function() {

	/**
	 * Textually searches arrays and hashes of objects
	 * by property (or multiple properties). Designed
	 * specifically for autocomplete.
	 *
	 * @constructor
	 * @param {array|object} items
	 * @param {object} items
	 */
	var Sifter = function(items, settings) {
		this.items = items;
		this.settings = settings || {diacritics: true};
	};

	/**
	 * Splits a search string into an array of individual
	 * regexps to be used to match results.
	 *
	 * @param {string} query
	 * @returns {array}
	 */
	Sifter.prototype.tokenize = function(query) {
		query = trim(String(query || '').toLowerCase());
		if (!query || !query.length) return [];

		var i, n, regex, letter;
		var tokens = [];
		var words = query.split(/ +/);

		for (i = 0, n = words.length; i < n; i++) {
			regex = escape_regex(words[i]);
			if (this.settings.diacritics) {
				for (letter in DIACRITICS) {
					if (DIACRITICS.hasOwnProperty(letter)) {
						regex = regex.replace(new RegExp(letter, 'g'), DIACRITICS[letter]);
					}
				}
			}
			tokens.push({
				string : words[i],
				regex  : new RegExp(regex, 'i')
			});
		}

		return tokens;
	};

	/**
	 * Iterates over arrays and hashes.
	 *
	 * ```
	 * this.iterator(this.items, function(item, id) {
	 *    // invoked for each item
	 * });
	 * ```
	 *
	 * @param {array|object} object
	 */
	Sifter.prototype.iterator = function(object, callback) {
		var iterator;
		if (is_array(object)) {
			iterator = Array.prototype.forEach || function(callback) {
				for (var i = 0, n = this.length; i < n; i++) {
					callback(this[i], i, this);
				}
			};
		} else {
			iterator = function(callback) {
				for (var key in this) {
					if (this.hasOwnProperty(key)) {
						callback(this[key], key, this);
					}
				}
			};
		}

		iterator.apply(object, [callback]);
	};

	/**
	 * Returns a function to be used to score individual results.
	 *
	 * Good matches will have a higher score than poor matches.
	 * If an item is not a match, 0 will be returned by the function.
	 *
	 * @param {object|string} search
	 * @param {object} options (optional)
	 * @returns {function}
	 */
	Sifter.prototype.getScoreFunction = function(search, options) {
		var self, fields, tokens, token_count;

		self        = this;
		search      = self.prepareSearch(search, options);
		tokens      = search.tokens;
		fields      = search.options.fields;
		token_count = tokens.length;

		/**
		 * Calculates how close of a match the
		 * given value is against a search token.
		 *
		 * @param {mixed} value
		 * @param {object} token
		 * @return {number}
		 */
		var scoreValue = function(value, token) {
			var score, pos;

			if (!value) return 0;
			value = String(value || '');
			pos = value.search(token.regex);
			if (pos === -1) return 0;
			score = token.string.length / value.length;
			if (pos === 0) score += 0.5;
			return score;
		};

		/**
		 * Calculates the score of an object
		 * against the search query.
		 *
		 * @param {object} token
		 * @param {object} data
		 * @return {number}
		 */
		var scoreObject = (function() {
			var field_count = fields.length;
			if (!field_count) {
				return function() { return 0; };
			}
			if (field_count === 1) {
				return function(token, data) {
					return scoreValue(data[fields[0]], token);
				};
			}
			return function(token, data) {
				for (var i = 0, sum = 0; i < field_count; i++) {
					sum += scoreValue(data[fields[i]], token);
				}
				return sum / field_count;
			};
		})();

		if (!token_count) {
			return function() { return 0; };
		}
		if (token_count === 1) {
			return function(data) {
				return scoreObject(tokens[0], data);
			};
		}

		if (search.options.conjunction === 'and') {
			return function(data) {
				var score;
				for (var i = 0, sum = 0; i < token_count; i++) {
					score = scoreObject(tokens[i], data);
					if (score <= 0) return 0;
					sum += score;
				}
				return sum / token_count;
			};
		} else {
			return function(data) {
				for (var i = 0, sum = 0; i < token_count; i++) {
					sum += scoreObject(tokens[i], data);
				}
				return sum / token_count;
			};
		}
	};

	/**
	 * Returns a function that can be used to compare two
	 * results, for sorting purposes. If no sorting should
	 * be performed, `null` will be returned.
	 *
	 * @param {string|object} search
	 * @param {object} options
	 * @return function(a,b)
	 */
	Sifter.prototype.getSortFunction = function(search, options) {
		var i, n, self, field, fields, fields_count, multiplier, multipliers, get_field, implicit_score, sort;

		self   = this;
		search = self.prepareSearch(search, options);
		sort   = (!search.query && options.sort_empty) || options.sort;

		/**
		 * Fetches the specified sort field value
		 * from a search result item.
		 *
		 * @param  {string} name
		 * @param  {object} result
		 * @return {mixed}
		 */
		get_field = function(name, result) {
			if (name === '$score') return result.score;
			return self.items[result.id][name];
		};

		// parse options
		fields = [];
		if (sort) {
			for (i = 0, n = sort.length; i < n; i++) {
				if (search.query || sort[i].field !== '$score') {
					fields.push(sort[i]);
				}
			}
		}

		// the "$score" field is implied to be the primary
		// sort field, unless it's manually specified
		if (search.query) {
			implicit_score = true;
			for (i = 0, n = fields.length; i < n; i++) {
				if (fields[i].field === '$score') {
					implicit_score = false;
					break;
				}
			}
			if (implicit_score) {
				fields.unshift({field: '$score', direction: 'desc'});
			}
		} else {
			for (i = 0, n = fields.length; i < n; i++) {
				if (fields[i].field === '$score') {
					fields.splice(i, 1);
					break;
				}
			}
		}

		multipliers = [];
		for (i = 0, n = fields.length; i < n; i++) {
			multipliers.push(fields[i].direction === 'desc' ? -1 : 1);
		}

		// build function
		fields_count = fields.length;
		if (!fields_count) {
			return null;
		} else if (fields_count === 1) {
			field = fields[0].field;
			multiplier = multipliers[0];
			return function(a, b) {
				return multiplier * cmp(
					get_field(field, a),
					get_field(field, b)
				);
			};
		} else {
			return function(a, b) {
				var i, result, a_value, b_value, field;
				for (i = 0; i < fields_count; i++) {
					field = fields[i].field;
					result = multipliers[i] * cmp(
						get_field(field, a),
						get_field(field, b)
					);
					if (result) return result;
				}
				return 0;
			};
		}
	};

	/**
	 * Parses a search query and returns an object
	 * with tokens and fields ready to be populated
	 * with results.
	 *
	 * @param {string} query
	 * @param {object} options
	 * @returns {object}
	 */
	Sifter.prototype.prepareSearch = function(query, options) {
		if (typeof query === 'object') return query;

		options = extend({}, options);

		var option_fields     = options.fields;
		var option_sort       = options.sort;
		var option_sort_empty = options.sort_empty;

		if (option_fields && !is_array(option_fields)) options.fields = [option_fields];
		if (option_sort && !is_array(option_sort)) options.sort = [option_sort];
		if (option_sort_empty && !is_array(option_sort_empty)) options.sort_empty = [option_sort_empty];

		return {
			options : options,
			query   : String(query || '').toLowerCase(),
			tokens  : this.tokenize(query),
			total   : 0,
			items   : []
		};
	};

	/**
	 * Searches through all items and returns a sorted array of matches.
	 *
	 * The `options` parameter can contain:
	 *
	 *   - fields {string|array}
	 *   - sort {array}
	 *   - score {function}
	 *   - filter {bool}
	 *   - limit {integer}
	 *
	 * Returns an object containing:
	 *
	 *   - options {object}
	 *   - query {string}
	 *   - tokens {array}
	 *   - total {int}
	 *   - items {array}
	 *
	 * @param {string} query
	 * @param {object} options
	 * @returns {object}
	 */
	Sifter.prototype.search = function(query, options) {
		var self = this, value, score, search, calculateScore;
		var fn_sort;
		var fn_score;

		search  = this.prepareSearch(query, options);
		options = search.options;
		query   = search.query;

		// generate result scoring function
		fn_score = options.score || self.getScoreFunction(search);

		// perform search and sort
		if (query.length) {
			self.iterator(self.items, function(item, id) {
				score = fn_score(item);
				if (options.filter === false || score > 0) {
					search.items.push({'score': score, 'id': id});
				}
			});
		} else {
			self.iterator(self.items, function(item, id) {
				search.items.push({'score': 1, 'id': id});
			});
		}

		fn_sort = self.getSortFunction(search, options);
		if (fn_sort) search.items.sort(fn_sort);

		// apply limits
		search.total = search.items.length;
		if (typeof options.limit === 'number') {
			search.items = search.items.slice(0, options.limit);
		}

		return search;
	};

	// utilities
	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

	var cmp = function(a, b) {
		if (typeof a === 'number' && typeof b === 'number') {
			return a > b ? 1 : (a < b ? -1 : 0);
		}
		a = asciifold(String(a || ''));
		b = asciifold(String(b || ''));
		if (a > b) return 1;
		if (b > a) return -1;
		return 0;
	};

	var extend = function(a, b) {
		var i, n, k, object;
		for (i = 1, n = arguments.length; i < n; i++) {
			object = arguments[i];
			if (!object) continue;
			for (k in object) {
				if (object.hasOwnProperty(k)) {
					a[k] = object[k];
				}
			}
		}
		return a;
	};

	var trim = function(str) {
		return (str + '').replace(/^\s+|\s+$|/g, '');
	};

	var escape_regex = function(str) {
		return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
	};

	var is_array = Array.isArray || (typeof $ !== 'undefined' && $.isArray) || function(object) {
		return Object.prototype.toString.call(object) === '[object Array]';
	};

	var DIACRITICS = {
		'a': '[aÀÁÂÃÄÅàáâãäåĀāąĄ]',
		'c': '[cÇçćĆčČ]',
		'd': '[dđĐďĎð]',
		'e': '[eÈÉÊËèéêëěĚĒēęĘ]',
		'i': '[iÌÍÎÏìíîïĪī]',
		'l': '[lłŁ]',
		'n': '[nÑñňŇńŃ]',
		'o': '[oÒÓÔÕÕÖØòóôõöøŌō]',
		'r': '[rřŘ]',
		's': '[sŠšśŚ]',
		't': '[tťŤ]',
		'u': '[uÙÚÛÜùúûüůŮŪū]',
		'y': '[yŸÿýÝ]',
		'z': '[zŽžżŻźŹ]'
	};

	var asciifold = (function() {
		var i, n, k, chunk;
		var foreignletters = '';
		var lookup = {};
		for (k in DIACRITICS) {
			if (DIACRITICS.hasOwnProperty(k)) {
				chunk = DIACRITICS[k].substring(2, DIACRITICS[k].length - 1);
				foreignletters += chunk;
				for (i = 0, n = chunk.length; i < n; i++) {
					lookup[chunk.charAt(i)] = k;
				}
			}
		}
		var regexp = new RegExp('[' +  foreignletters + ']', 'g');
		return function(str) {
			return str.replace(regexp, function(foreignletter) {
				return lookup[foreignletter];
			}).toLowerCase();
		};
	})();


	// export
	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

	return Sifter;
}));


},{}],270:[function(require,module,exports){
/*
Slick Finder
*/"use strict"

// Notable changes from Slick.Finder 1.0.x

// faster bottom -> up expression matching
// prefers mental sanity over *obsessive compulsive* milliseconds savings
// uses prototypes instead of objects
// tries to use matchesSelector smartly, whenever available
// can populate objects as well as arrays
// lots of stuff is broken or not implemented

var parse = require("./parser")

// utilities

var index = 0,
    counter = document.__counter = (parseInt(document.__counter || -1, 36) + 1).toString(36),
    key = "uid:" + counter

var uniqueID = function(n, xml){
    if (n === window) return "window"
    if (n === document) return "document"
    if (n === document.documentElement) return "html"

    if (xml) {
        var uid = n.getAttribute(key)
        if (!uid) {
            uid = (index++).toString(36)
            n.setAttribute(key, uid)
        }
        return uid
    } else {
        return n[key] || (n[key] = (index++).toString(36))
    }
}

var uniqueIDXML = function(n) {
    return uniqueID(n, true)
}

var isArray = Array.isArray || function(object){
    return Object.prototype.toString.call(object) === "[object Array]"
}

// tests

var uniqueIndex = 0;

var HAS = {

    GET_ELEMENT_BY_ID: function(test, id){
        id = "slick_" + (uniqueIndex++);
        // checks if the document has getElementById, and it works
        test.innerHTML = '<a id="' + id + '"></a>'
        return !!this.getElementById(id)
    },

    QUERY_SELECTOR: function(test){
        // this supposedly fixes a webkit bug with matchesSelector / querySelector & nth-child
        test.innerHTML = '_<style>:nth-child(2){}</style>'

        // checks if the document has querySelectorAll, and it works
        test.innerHTML = '<a class="MiX"></a>'

        return test.querySelectorAll('.MiX').length === 1
    },

    EXPANDOS: function(test, id){
        id = "slick_" + (uniqueIndex++);
        // checks if the document has elements that support expandos
        test._custom_property_ = id
        return test._custom_property_ === id
    },

    // TODO: use this ?

    // CHECKED_QUERY_SELECTOR: function(test){
    //
    //     // checks if the document supports the checked query selector
    //     test.innerHTML = '<select><option selected="selected">a</option></select>'
    //     return test.querySelectorAll(':checked').length === 1
    // },

    // TODO: use this ?

    // EMPTY_ATTRIBUTE_QUERY_SELECTOR: function(test){
    //
    //     // checks if the document supports the empty attribute query selector
    //     test.innerHTML = '<a class=""></a>'
    //     return test.querySelectorAll('[class*=""]').length === 1
    // },

    MATCHES_SELECTOR: function(test){

        test.className = "MiX"

        // checks if the document has matchesSelector, and we can use it.

        var matches = test.matchesSelector || test.mozMatchesSelector || test.webkitMatchesSelector

        // if matchesSelector trows errors on incorrect syntax we can use it
        if (matches) try {
            matches.call(test, ':slick')
        } catch(e){
            // just as a safety precaution, also test if it works on mixedcase (like querySelectorAll)
            return matches.call(test, ".MiX") ? matches : false
        }

        return false
    },

    GET_ELEMENTS_BY_CLASS_NAME: function(test){
        test.innerHTML = '<a class="f"></a><a class="b"></a>'
        if (test.getElementsByClassName('b').length !== 1) return false

        test.firstChild.className = 'b'
        if (test.getElementsByClassName('b').length !== 2) return false

        // Opera 9.6 getElementsByClassName doesnt detects the class if its not the first one
        test.innerHTML = '<a class="a"></a><a class="f b a"></a>'
        if (test.getElementsByClassName('a').length !== 2) return false

        // tests passed
        return true
    },

    // no need to know

    // GET_ELEMENT_BY_ID_NOT_NAME: function(test, id){
    //     test.innerHTML = '<a name="'+ id +'"></a><b id="'+ id +'"></b>'
    //     return this.getElementById(id) !== test.firstChild
    // },

    // this is always checked for and fixed

    // STAR_GET_ELEMENTS_BY_TAG_NAME: function(test){
    //
    //     // IE returns comment nodes for getElementsByTagName('*') for some documents
    //     test.appendChild(this.createComment(''))
    //     if (test.getElementsByTagName('*').length > 0) return false
    //
    //     // IE returns closed nodes (EG:"</foo>") for getElementsByTagName('*') for some documents
    //     test.innerHTML = 'foo</foo>'
    //     if (test.getElementsByTagName('*').length) return false
    //
    //     // tests passed
    //     return true
    // },

    // this is always checked for and fixed

    // STAR_QUERY_SELECTOR: function(test){
    //
    //     // returns closed nodes (EG:"</foo>") for querySelector('*') for some documents
    //     test.innerHTML = 'foo</foo>'
    //     return !!(test.querySelectorAll('*').length)
    // },

    GET_ATTRIBUTE: function(test){
        // tests for working getAttribute implementation
        var shout = "fus ro dah"
        test.innerHTML = '<a class="' + shout + '"></a>'
        return test.firstChild.getAttribute('class') === shout
    }

}

// Finder

var Finder = function Finder(document){

    this.document        = document
    var root = this.root = document.documentElement
    this.tested          = {}

    // uniqueID

    this.uniqueID = this.has("EXPANDOS") ? uniqueID : uniqueIDXML

    // getAttribute

    this.getAttribute = (this.has("GET_ATTRIBUTE")) ? function(node, name){

        return node.getAttribute(name)

    } : function(node, name){

        node = node.getAttributeNode(name)
        return (node && node.specified) ? node.value : null

    }

    // hasAttribute

    this.hasAttribute = (root.hasAttribute) ? function(node, attribute){

        return node.hasAttribute(attribute)

    } : function(node, attribute) {

        node = node.getAttributeNode(attribute)
        return !!(node && node.specified)

    }

    // contains

    this.contains = (document.contains && root.contains) ? function(context, node){

        return context.contains(node)

    } : (root.compareDocumentPosition) ? function(context, node){

        return context === node || !!(context.compareDocumentPosition(node) & 16)

    } : function(context, node){

        do {
            if (node === context) return true
        } while ((node = node.parentNode))

        return false
    }

    // sort
    // credits to Sizzle (http://sizzlejs.com/)

    this.sorter = (root.compareDocumentPosition) ? function(a, b){

        if (!a.compareDocumentPosition || !b.compareDocumentPosition) return 0
        return a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1

    } : ('sourceIndex' in root) ? function(a, b){

        if (!a.sourceIndex || !b.sourceIndex) return 0
        return a.sourceIndex - b.sourceIndex

    } : (document.createRange) ? function(a, b){

        if (!a.ownerDocument || !b.ownerDocument) return 0
        var aRange = a.ownerDocument.createRange(),
            bRange = b.ownerDocument.createRange()

        aRange.setStart(a, 0)
        aRange.setEnd(a, 0)
        bRange.setStart(b, 0)
        bRange.setEnd(b, 0)
        return aRange.compareBoundaryPoints(Range.START_TO_END, bRange)

    } : null

    this.failed = {}

    var nativeMatches = this.has("MATCHES_SELECTOR")

    if (nativeMatches) this.matchesSelector = function(node, expression){

        if (this.failed[expression]) return null

        try {
            return nativeMatches.call(node, expression)
        } catch(e){
            if (slick.debug) console.warn("matchesSelector failed on " + expression)
            this.failed[expression] = true
            return null
        }

    }

    if (this.has("QUERY_SELECTOR")){

        this.querySelectorAll = function(node, expression){

            if (this.failed[expression]) return true

            var result, _id, _expression, _combinator, _node


            // non-document rooted QSA
            // credits to Andrew Dupont

            if (node !== this.document){

                _combinator = expression[0].combinator

                _id         = node.getAttribute("id")
                _expression = expression

                if (!_id){
                    _node = node
                    _id = "__slick__"
                    _node.setAttribute("id", _id)
                }

                expression = "#" + _id + " " + _expression


                // these combinators need a parentNode due to how querySelectorAll works, which is:
                // finding all the elements that match the given selector
                // then filtering by the ones that have the specified element as an ancestor
                if (_combinator.indexOf("~") > -1 || _combinator.indexOf("+") > -1){

                    node = node.parentNode
                    if (!node) result = true
                    // if node has no parentNode, we return "true" as if it failed, without polluting the failed cache

                }

            }

            if (!result) try {
                result = node.querySelectorAll(expression.toString())
            } catch(e){
                if (slick.debug) console.warn("querySelectorAll failed on " + (_expression || expression))
                result = this.failed[_expression || expression] = true
            }

            if (_node) _node.removeAttribute("id")

            return result

        }

    }

}

Finder.prototype.has = function(FEATURE){

    var tested        = this.tested,
        testedFEATURE = tested[FEATURE]

    if (testedFEATURE != null) return testedFEATURE

    var root     = this.root,
        document = this.document,
        testNode = document.createElement("div")

    testNode.setAttribute("style", "display: none;")

    root.appendChild(testNode)

    var TEST = HAS[FEATURE], result = false

    if (TEST) try {
        result = TEST.call(document, testNode)
    } catch(e){}

    if (slick.debug && !result) console.warn("document has no " + FEATURE)

    root.removeChild(testNode)

    return tested[FEATURE] = result

}

var combinators = {

    " ": function(node, part, push){

        var item, items

        var noId = !part.id, noTag = !part.tag, noClass = !part.classes

        if (part.id && node.getElementById && this.has("GET_ELEMENT_BY_ID")){
            item = node.getElementById(part.id)

            // return only if id is found, else keep checking
            // might be a tad slower on non-existing ids, but less insane

            if (item && item.getAttribute('id') === part.id){
                items = [item]
                noId = true
                // if tag is star, no need to check it in match()
                if (part.tag === "*") noTag = true
            }
        }

        if (!items){

            if (part.classes && node.getElementsByClassName && this.has("GET_ELEMENTS_BY_CLASS_NAME")){
                items = node.getElementsByClassName(part.classList)
                noClass = true
                // if tag is star, no need to check it in match()
                if (part.tag === "*") noTag = true
            } else {
                items = node.getElementsByTagName(part.tag)
                // if tag is star, need to check it in match because it could select junk, boho
                if (part.tag !== "*") noTag = true
            }

            if (!items || !items.length) return false

        }

        for (var i = 0; item = items[i++];)
            if ((noTag && noId && noClass && !part.attributes && !part.pseudos) || this.match(item, part, noTag, noId, noClass))
                push(item)

        return true

    },

    ">": function(node, part, push){ // direct children
        if ((node = node.firstChild)) do {
            if (node.nodeType == 1 && this.match(node, part)) push(node)
        } while ((node = node.nextSibling))
    },

    "+": function(node, part, push){ // next sibling
        while ((node = node.nextSibling)) if (node.nodeType == 1){
            if (this.match(node, part)) push(node)
            break
        }
    },

    "^": function(node, part, push){ // first child
        node = node.firstChild
        if (node){
            if (node.nodeType === 1){
                if (this.match(node, part)) push(node)
            } else {
                combinators['+'].call(this, node, part, push)
            }
        }
    },

    "~": function(node, part, push){ // next siblings
        while ((node = node.nextSibling)){
            if (node.nodeType === 1 && this.match(node, part)) push(node)
        }
    },

    "++": function(node, part, push){ // next sibling and previous sibling
        combinators['+'].call(this, node, part, push)
        combinators['!+'].call(this, node, part, push)
    },

    "~~": function(node, part, push){ // next siblings and previous siblings
        combinators['~'].call(this, node, part, push)
        combinators['!~'].call(this, node, part, push)
    },

    "!": function(node, part, push){ // all parent nodes up to document
        while ((node = node.parentNode)) if (node !== this.document && this.match(node, part)) push(node)
    },

    "!>": function(node, part, push){ // direct parent (one level)
        node = node.parentNode
        if (node !== this.document && this.match(node, part)) push(node)
    },

    "!+": function(node, part, push){ // previous sibling
        while ((node = node.previousSibling)) if (node.nodeType == 1){
            if (this.match(node, part)) push(node)
            break
        }
    },

    "!^": function(node, part, push){ // last child
        node = node.lastChild
        if (node){
            if (node.nodeType == 1){
                if (this.match(node, part)) push(node)
            } else {
                combinators['!+'].call(this, node, part, push)
            }
        }
    },

    "!~": function(node, part, push){ // previous siblings
        while ((node = node.previousSibling)){
            if (node.nodeType === 1 && this.match(node, part)) push(node)
        }
    }

}

Finder.prototype.search = function(context, expression, found){

    if (!context) context = this.document
    else if (!context.nodeType && context.document) context = context.document

    var expressions = parse(expression)

    // no expressions were parsed. todo: is this really necessary?
    if (!expressions || !expressions.length) throw new Error("invalid expression")

    if (!found) found = []

    var uniques, push = isArray(found) ? function(node){
        found[found.length] = node
    } : function(node){
        found[found.length++] = node
    }

    // if there is more than one expression we need to check for duplicates when we push to found
    // this simply saves the old push and wraps it around an uid dupe check.
    if (expressions.length > 1){
        uniques = {}
        var plush = push
        push = function(node){
            var uid = uniqueID(node)
            if (!uniques[uid]){
                uniques[uid] = true
                plush(node)
            }
        }
    }

    // walker

    var node, nodes, part

    main: for (var i = 0; expression = expressions[i++];){

        // querySelector

        // TODO: more functional tests

        // if there is querySelectorAll (and the expression does not fail) use it.
        if (!slick.noQSA && this.querySelectorAll){

            nodes = this.querySelectorAll(context, expression)
            if (nodes !== true){
                if (nodes && nodes.length) for (var j = 0; node = nodes[j++];) if (node.nodeName > '@'){
                    push(node)
                }
                continue main
            }
        }

        // if there is only one part in the expression we don't need to check each part for duplicates.
        // todo: this might be too naive. while solid, there can be expression sequences that do not
        // produce duplicates. "body div" for instance, can never give you each div more than once.
        // "body div a" on the other hand might.
        if (expression.length === 1){

            part = expression[0]
            combinators[part.combinator].call(this, context, part, push)

        } else {

            var cs = [context], c, f, u, p = function(node){
                var uid = uniqueID(node)
                if (!u[uid]){
                    u[uid] = true
                    f[f.length] = node
                }
            }

            // loop the expression parts
            for (var j = 0; part = expression[j++];){
                f = []; u = {}
                // loop the contexts
                for (var k = 0; c = cs[k++];) combinators[part.combinator].call(this, c, part, p)
                // nothing was found, the expression failed, continue to the next expression.
                if (!f.length) continue main
                cs = f // set the contexts for future parts (if any)
            }

            if (i === 0) found = f // first expression. directly set found.
            else for (var l = 0; l < f.length; l++) push(f[l]) // any other expression needs to push to found.
        }

    }

    if (uniques && found && found.length > 1) this.sort(found)

    return found

}

Finder.prototype.sort = function(nodes){
    return this.sorter ? Array.prototype.sort.call(nodes, this.sorter) : nodes
}

// TODO: most of these pseudo selectors include <html> and qsa doesnt. fixme.

var pseudos = {


    // TODO: returns different results than qsa empty.

    'empty': function(){
        return !(this && this.nodeType === 1) && !(this.innerText || this.textContent || '').length
    },

    'not': function(expression){
        return !slick.matches(this, expression)
    },

    'contains': function(text){
        return (this.innerText || this.textContent || '').indexOf(text) > -1
    },

    'first-child': function(){
        var node = this
        while ((node = node.previousSibling)) if (node.nodeType == 1) return false
        return true
    },

    'last-child': function(){
        var node = this
        while ((node = node.nextSibling)) if (node.nodeType == 1) return false
        return true
    },

    'only-child': function(){
        var prev = this
        while ((prev = prev.previousSibling)) if (prev.nodeType == 1) return false

        var next = this
        while ((next = next.nextSibling)) if (next.nodeType == 1) return false

        return true
    },

    'first-of-type': function(){
        var node = this, nodeName = node.nodeName
        while ((node = node.previousSibling)) if (node.nodeName == nodeName) return false
        return true
    },

    'last-of-type': function(){
        var node = this, nodeName = node.nodeName
        while ((node = node.nextSibling)) if (node.nodeName == nodeName) return false
        return true
    },

    'only-of-type': function(){
        var prev = this, nodeName = this.nodeName
        while ((prev = prev.previousSibling)) if (prev.nodeName == nodeName) return false
        var next = this
        while ((next = next.nextSibling)) if (next.nodeName == nodeName) return false
        return true
    },

    'enabled': function(){
        return !this.disabled
    },

    'disabled': function(){
        return this.disabled
    },

    'checked': function(){
        return this.checked || this.selected
    },

    'selected': function(){
        return this.selected
    },

    'focus': function(){
        var doc = this.ownerDocument
        return doc.activeElement === this && (this.href || this.type || slick.hasAttribute(this, 'tabindex'))
    },

    'root': function(){
        return (this === this.ownerDocument.documentElement)
    }

}

Finder.prototype.match = function(node, bit, noTag, noId, noClass){

    // TODO: more functional tests ?

    if (!slick.noQSA && this.matchesSelector){
        var matches = this.matchesSelector(node, bit)
        if (matches !== null) return matches
    }

    // normal matching

    if (!noTag && bit.tag){

        var nodeName = node.nodeName.toLowerCase()
        if (bit.tag === "*"){
            if (nodeName < "@") return false
        } else if (nodeName != bit.tag){
            return false
        }

    }

    if (!noId && bit.id && node.getAttribute('id') !== bit.id) return false

    var i, part

    if (!noClass && bit.classes){

        var className = this.getAttribute(node, "class")
        if (!className) return false

        for (part in bit.classes) if (!RegExp('(^|\\s)' + bit.classes[part] + '(\\s|$)').test(className)) return false
    }

    var name, value

    if (bit.attributes) for (i = 0; part = bit.attributes[i++];){

        var operator  = part.operator,
            escaped   = part.escapedValue

        name  = part.name
        value = part.value

        if (!operator){

            if (!this.hasAttribute(node, name)) return false

        } else {

            var actual = this.getAttribute(node, name)
            if (actual == null) return false

            switch (operator){
                case '^=' : if (!RegExp(      '^' + escaped            ).test(actual)) return false; break
                case '$=' : if (!RegExp(            escaped + '$'      ).test(actual)) return false; break
                case '~=' : if (!RegExp('(^|\\s)' + escaped + '(\\s|$)').test(actual)) return false; break
                case '|=' : if (!RegExp(      '^' + escaped + '(-|$)'  ).test(actual)) return false; break

                case '='  : if (actual !== value) return false; break
                case '*=' : if (actual.indexOf(value) === -1) return false; break
                default   : return false
            }

        }
    }

    if (bit.pseudos) for (i = 0; part = bit.pseudos[i++];){

        name  = part.name
        value = part.value

        if (pseudos[name]) return pseudos[name].call(node, value)

        if (value != null){
            if (this.getAttribute(node, name) !== value) return false
        } else {
            if (!this.hasAttribute(node, name)) return false
        }

    }

    return true

}

Finder.prototype.matches = function(node, expression){

    var expressions = parse(expression)

    if (expressions.length === 1 && expressions[0].length === 1){ // simplest match
        return this.match(node, expressions[0][0])
    }

    // TODO: more functional tests ?

    if (!slick.noQSA && this.matchesSelector){
        var matches = this.matchesSelector(node, expressions)
        if (matches !== null) return matches
    }

    var nodes = this.search(this.document, expression, {length: 0})

    for (var i = 0, res; res = nodes[i++];) if (node === res) return true
    return false

}

var finders = {}

var finder = function(context){
    var doc = context || document
    if (doc.ownerDocument) doc = doc.ownerDocument
    else if (doc.document) doc = doc.document

    if (doc.nodeType !== 9) throw new TypeError("invalid document")

    var uid = uniqueID(doc)
    return finders[uid] || (finders[uid] = new Finder(doc))
}

// ... API ...

var slick = function(expression, context){
    return slick.search(expression, context)
}

slick.search = function(expression, context, found){
    return finder(context).search(context, expression, found)
}

slick.find = function(expression, context){
    return finder(context).search(context, expression)[0] || null
}

slick.getAttribute = function(node, name){
    return finder(node).getAttribute(node, name)
}

slick.hasAttribute = function(node, name){
    return finder(node).hasAttribute(node, name)
}

slick.contains = function(context, node){
    return finder(context).contains(context, node)
}

slick.matches = function(node, expression){
    return finder(node).matches(node, expression)
}

slick.sort = function(nodes){
    if (nodes && nodes.length > 1) finder(nodes[0]).sort(nodes)
    return nodes
}

slick.parse = parse;

// slick.debug = true
// slick.noQSA  = true

module.exports = slick

},{"./parser":272}],271:[function(require,module,exports){
(function (global){
/*
slick
*/"use strict"

module.exports = "document" in global ? require("./finder") : { parse: require("./parser") }

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./finder":270,"./parser":272}],272:[function(require,module,exports){
/*
Slick Parser
 - originally created by the almighty Thomas Aylott <@subtlegradient> (http://subtlegradient.com)
*/"use strict"

// Notable changes from Slick.Parser 1.0.x

// The parser now uses 2 classes: Expressions and Expression
// `new Expressions` produces an array-like object containing a list of Expression objects
// - Expressions::toString() produces a cleaned up expressions string
// `new Expression` produces an array-like object
// - Expression::toString() produces a cleaned up expression string
// The only exposed method is parse, which produces a (cached) `new Expressions` instance
// parsed.raw is no longer present, use .toString()
// parsed.expression is now useless, just use the indices
// parsed.reverse() has been removed for now, due to its apparent uselessness
// Other changes in the Expressions object:
// - classNames are now unique, and save both escaped and unescaped values
// - attributes now save both escaped and unescaped values
// - pseudos now save both escaped and unescaped values

var escapeRe   = /([-.*+?^${}()|[\]\/\\])/g,
    unescapeRe = /\\/g

var escape = function(string){
    // XRegExp v2.0.0-beta-3
    // « https://github.com/slevithan/XRegExp/blob/master/src/xregexp.js
    return (string + "").replace(escapeRe, '\\$1')
}

var unescape = function(string){
    return (string + "").replace(unescapeRe, '')
}

var slickRe = RegExp(
/*
#!/usr/bin/env ruby
puts "\t\t" + DATA.read.gsub(/\(\?x\)|\s+#.*$|\s+|\\$|\\n/,'')
__END__
    "(?x)^(?:\
      \\s* ( , ) \\s*               # Separator          \n\
    | \\s* ( <combinator>+ ) \\s*   # Combinator         \n\
    |      ( \\s+ )                 # CombinatorChildren \n\
    |      ( <unicode>+ | \\* )     # Tag                \n\
    | \\#  ( <unicode>+       )     # ID                 \n\
    | \\.  ( <unicode>+       )     # ClassName          \n\
    |                               # Attribute          \n\
    \\[  \
        \\s* (<unicode1>+)  (?:  \
            \\s* ([*^$!~|]?=)  (?:  \
                \\s* (?:\
                    ([\"']?)(.*?)\\9 \
                )\
            )  \
        )?  \\s*  \
    \\](?!\\]) \n\
    |   :+ ( <unicode>+ )(?:\
    \\( (?:\
        (?:([\"'])([^\\12]*)\\12)|((?:\\([^)]+\\)|[^()]*)+)\
    ) \\)\
    )?\
    )"
*/
"^(?:\\s*(,)\\s*|\\s*(<combinator>+)\\s*|(\\s+)|(<unicode>+|\\*)|\\#(<unicode>+)|\\.(<unicode>+)|\\[\\s*(<unicode1>+)(?:\\s*([*^$!~|]?=)(?:\\s*(?:([\"']?)(.*?)\\9)))?\\s*\\](?!\\])|(:+)(<unicode>+)(?:\\((?:(?:([\"'])([^\\13]*)\\13)|((?:\\([^)]+\\)|[^()]*)+))\\))?)"
    .replace(/<combinator>/, '[' + escape(">+~`!@$%^&={}\\;</") + ']')
    .replace(/<unicode>/g, '(?:[\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])')
    .replace(/<unicode1>/g, '(?:[:\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])')
)

// Part

var Part = function Part(combinator){
    this.combinator = combinator || " "
    this.tag = "*"
}

Part.prototype.toString = function(){

    if (!this.raw){

        var xpr = "", k, part

        xpr += this.tag || "*"
        if (this.id) xpr += "#" + this.id
        if (this.classes) xpr += "." + this.classList.join(".")
        if (this.attributes) for (k = 0; part = this.attributes[k++];){
            xpr += "[" + part.name + (part.operator ? part.operator + '"' + part.value + '"' : '') + "]"
        }
        if (this.pseudos) for (k = 0; part = this.pseudos[k++];){
            xpr += ":" + part.name
            if (part.value) xpr += "(" + part.value + ")"
        }

        this.raw = xpr

    }

    return this.raw
}

// Expression

var Expression = function Expression(){
    this.length = 0
}

Expression.prototype.toString = function(){

    if (!this.raw){

        var xpr = ""

        for (var j = 0, bit; bit = this[j++];){
            if (j !== 1) xpr += " "
            if (bit.combinator !== " ") xpr += bit.combinator + " "
            xpr += bit
        }

        this.raw = xpr

    }

    return this.raw
}

var replacer = function(
    rawMatch,

    separator,
    combinator,
    combinatorChildren,

    tagName,
    id,
    className,

    attributeKey,
    attributeOperator,
    attributeQuote,
    attributeValue,

    pseudoMarker,
    pseudoClass,
    pseudoQuote,
    pseudoClassQuotedValue,
    pseudoClassValue
){

    var expression, current

    if (separator || !this.length){
        expression = this[this.length++] = new Expression
        if (separator) return ''
    }

    if (!expression) expression = this[this.length - 1]

    if (combinator || combinatorChildren || !expression.length){
        current = expression[expression.length++] = new Part(combinator)
    }

    if (!current) current = expression[expression.length - 1]

    if (tagName){

        current.tag = unescape(tagName)

    } else if (id){

        current.id = unescape(id)

    } else if (className){

        var unescaped = unescape(className)

        var classes = current.classes || (current.classes = {})
        if (!classes[unescaped]){
            classes[unescaped] = escape(className)
            var classList = current.classList || (current.classList = [])
            classList.push(unescaped)
            classList.sort()
        }

    } else if (pseudoClass){

        pseudoClassValue = pseudoClassValue || pseudoClassQuotedValue

        ;(current.pseudos || (current.pseudos = [])).push({
            type         : pseudoMarker.length == 1 ? 'class' : 'element',
            name         : unescape(pseudoClass),
            escapedName  : escape(pseudoClass),
            value        : pseudoClassValue ? unescape(pseudoClassValue) : null,
            escapedValue : pseudoClassValue ? escape(pseudoClassValue) : null
        })

    } else if (attributeKey){

        attributeValue = attributeValue ? escape(attributeValue) : null

        ;(current.attributes || (current.attributes = [])).push({
            operator     : attributeOperator,
            name         : unescape(attributeKey),
            escapedName  : escape(attributeKey),
            value        : attributeValue ? unescape(attributeValue) : null,
            escapedValue : attributeValue ? escape(attributeValue) : null
        })

    }

    return ''

}

// Expressions

var Expressions = function Expressions(expression){
    this.length = 0

    var self = this

    var original = expression, replaced

    while (expression){
        replaced = expression.replace(slickRe, function(){
            return replacer.apply(self, arguments)
        })
        if (replaced === expression) throw new Error(original + ' is an invalid expression')
        expression = replaced
    }
}

Expressions.prototype.toString = function(){
    if (!this.raw){
        var expressions = []
        for (var i = 0, expression; expression = this[i++];) expressions.push(expression)
        this.raw = expressions.join(", ")
    }

    return this.raw
}

var cache = {}

var parse = function(expression){
    if (expression == null) return null
    expression = ('' + expression).replace(/^\s+|\s+$/g, '')
    return cache[expression] || (cache[expression] = new Expressions(expression))
}

module.exports = parse

},{}],273:[function(require,module,exports){
/**!
 * Sortable
 * @author	RubaXa   <trash@rubaxa.org>
 * @license MIT
 */


(function (factory) {
	"use strict";

	if (typeof define === "function" && define.amd) {
		define(factory);
	}
	else if (typeof module != "undefined" && typeof module.exports != "undefined") {
		module.exports = factory();
	}
	else if (typeof Package !== "undefined") {
		Sortable = factory();  // export for Meteor.js
	}
	else {
		/* jshint sub:true */
		window["Sortable"] = factory();
	}
})(function () {
	"use strict";

	var dragEl,
		parentEl,
		ghostEl,
		cloneEl,
		rootEl,
		nextEl,

		scrollEl,
		scrollParentEl,

		lastEl,
		lastCSS,
		lastParentCSS,

		oldIndex,
		newIndex,

		activeGroup,
		autoScroll = {},

		tapEvt,
		touchEvt,

		moved,

		/** @const */
		RSPACE = /\s+/g,

		expando = 'Sortable' + (new Date).getTime(),

		win = window,
		document = win.document,
		parseInt = win.parseInt,

		supportDraggable = !!('draggable' in document.createElement('div')),
		supportCssPointerEvents = (function (el) {
			el = document.createElement('x');
			el.style.cssText = 'pointer-events:auto';
			return el.style.pointerEvents === 'auto';
		})(),

		_silent = false,

		abs = Math.abs,
		slice = [].slice,

		touchDragOverListeners = [],

		_autoScroll = _throttle(function (/**Event*/evt, /**Object*/options, /**HTMLElement*/rootEl) {
			// Bug: https://bugzilla.mozilla.org/show_bug.cgi?id=505521
			if (rootEl && options.scroll) {
				var el,
					rect,
					sens = options.scrollSensitivity,
					speed = options.scrollSpeed,

					x = evt.clientX,
					y = evt.clientY,

					winWidth = window.innerWidth,
					winHeight = window.innerHeight,

					vx,
					vy
				;

				// Delect scrollEl
				if (scrollParentEl !== rootEl) {
					scrollEl = options.scroll;
					scrollParentEl = rootEl;

					if (scrollEl === true) {
						scrollEl = rootEl;

						do {
							if ((scrollEl.offsetWidth < scrollEl.scrollWidth) ||
								(scrollEl.offsetHeight < scrollEl.scrollHeight)
							) {
								break;
							}
							/* jshint boss:true */
						} while (scrollEl = scrollEl.parentNode);
					}
				}

				if (scrollEl) {
					el = scrollEl;
					rect = scrollEl.getBoundingClientRect();
					vx = (abs(rect.right - x) <= sens) - (abs(rect.left - x) <= sens);
					vy = (abs(rect.bottom - y) <= sens) - (abs(rect.top - y) <= sens);
				}


				if (!(vx || vy)) {
					vx = (winWidth - x <= sens) - (x <= sens);
					vy = (winHeight - y <= sens) - (y <= sens);

					/* jshint expr:true */
					(vx || vy) && (el = win);
				}


				if (autoScroll.vx !== vx || autoScroll.vy !== vy || autoScroll.el !== el) {
					autoScroll.el = el;
					autoScroll.vx = vx;
					autoScroll.vy = vy;

					clearInterval(autoScroll.pid);

					if (el) {
						autoScroll.pid = setInterval(function () {
							if (el === win) {
								win.scrollTo(win.pageXOffset + vx * speed, win.pageYOffset + vy * speed);
							} else {
								vy && (el.scrollTop += vy * speed);
								vx && (el.scrollLeft += vx * speed);
							}
						}, 24);
					}
				}
			}
		}, 30),

		_prepareGroup = function (options) {
			var group = options.group;

			if (!group || typeof group != 'object') {
				group = options.group = {name: group};
			}

			['pull', 'put'].forEach(function (key) {
				if (!(key in group)) {
					group[key] = true;
				}
			});

			options.groups = ' ' + group.name + (group.put.join ? ' ' + group.put.join(' ') : '') + ' ';
		}
	;



	/**
	 * @class  Sortable
	 * @param  {HTMLElement}  el
	 * @param  {Object}       [options]
	 */
	function Sortable(el, options) {
		if (!(el && el.nodeType && el.nodeType === 1)) {
			throw 'Sortable: `el` must be HTMLElement, and not ' + {}.toString.call(el);
		}

		this.el = el; // root element
		this.options = options = _extend({}, options);


		// Export instance
		el[expando] = this;


		// Default options
		var defaults = {
			group: Math.random(),
			sort: true,
			disabled: false,
			store: null,
			handle: null,
			scroll: true,
			scrollSensitivity: 30,
			scrollSpeed: 10,
			draggable: /[uo]l/i.test(el.nodeName) ? 'li' : '>*',
			ghostClass: 'sortable-ghost',
			chosenClass: 'sortable-chosen',
			ignore: 'a, img',
			filter: null,
			animation: 0,
			setData: function (dataTransfer, dragEl) {
				dataTransfer.setData('Text', dragEl.textContent);
			},
			dropBubble: false,
			dragoverBubble: false,
			dataIdAttr: 'data-id',
			delay: 0,
			forceFallback: false,
			fallbackClass: 'sortable-fallback',
			fallbackOnBody: false
		};


		// Set default options
		for (var name in defaults) {
			!(name in options) && (options[name] = defaults[name]);
		}

		_prepareGroup(options);

		// Bind all private methods
		for (var fn in this) {
			if (fn.charAt(0) === '_') {
				this[fn] = this[fn].bind(this);
			}
		}

		// Setup drag mode
		this.nativeDraggable = options.forceFallback ? false : supportDraggable;

		// Bind events
		_on(el, 'mousedown', this._onTapStart);
		_on(el, 'touchstart', this._onTapStart);

		if (this.nativeDraggable) {
			_on(el, 'dragover', this);
			_on(el, 'dragenter', this);
		}

		touchDragOverListeners.push(this._onDragOver);

		// Restore sorting
		options.store && this.sort(options.store.get(this));
	}


	Sortable.prototype = /** @lends Sortable.prototype */ {
		constructor: Sortable,

		_onTapStart: function (/** Event|TouchEvent */evt) {
			var _this = this,
				el = this.el,
				options = this.options,
				type = evt.type,
				touch = evt.touches && evt.touches[0],
				target = (touch || evt).target,
				originalTarget = target,
				filter = options.filter;


			if (type === 'mousedown' && evt.button !== 0 || options.disabled) {
				return; // only left button or enabled
			}

			target = _closest(target, options.draggable, el);

			if (!target) {
				return;
			}

			// get the index of the dragged element within its parent
			oldIndex = _index(target);

			// Check filter
			if (typeof filter === 'function') {
				if (filter.call(this, evt, target, this)) {
					_dispatchEvent(_this, originalTarget, 'filter', target, el, oldIndex);
					evt.preventDefault();
					return; // cancel dnd
				}
			}
			else if (filter) {
				filter = filter.split(',').some(function (criteria) {
					criteria = _closest(originalTarget, criteria.trim(), el);

					if (criteria) {
						_dispatchEvent(_this, criteria, 'filter', target, el, oldIndex);
						return true;
					}
				});

				if (filter) {
					evt.preventDefault();
					return; // cancel dnd
				}
			}


			if (options.handle && !_closest(originalTarget, options.handle, el)) {
				return;
			}


			// Prepare `dragstart`
			this._prepareDragStart(evt, touch, target);
		},

		_prepareDragStart: function (/** Event */evt, /** Touch */touch, /** HTMLElement */target) {
			var _this = this,
				el = _this.el,
				options = _this.options,
				ownerDocument = el.ownerDocument,
				dragStartFn;

			if (target && !dragEl && (target.parentNode === el)) {
				tapEvt = evt;

				rootEl = el;
				dragEl = target;
				parentEl = dragEl.parentNode;
				nextEl = dragEl.nextSibling;
				activeGroup = options.group;

				dragStartFn = function () {
					// Delayed drag has been triggered
					// we can re-enable the events: touchmove/mousemove
					_this._disableDelayedDrag();

					// Make the element draggable
					dragEl.draggable = true;

					// Chosen item
					_toggleClass(dragEl, _this.options.chosenClass, true);

					// Bind the events: dragstart/dragend
					_this._triggerDragStart(touch);
				};

				// Disable "draggable"
				options.ignore.split(',').forEach(function (criteria) {
					_find(dragEl, criteria.trim(), _disableDraggable);
				});

				_on(ownerDocument, 'mouseup', _this._onDrop);
				_on(ownerDocument, 'touchend', _this._onDrop);
				_on(ownerDocument, 'touchcancel', _this._onDrop);

				if (options.delay) {
					// If the user moves the pointer or let go the click or touch
					// before the delay has been reached:
					// disable the delayed drag
					_on(ownerDocument, 'mouseup', _this._disableDelayedDrag);
					_on(ownerDocument, 'touchend', _this._disableDelayedDrag);
					_on(ownerDocument, 'touchcancel', _this._disableDelayedDrag);
					_on(ownerDocument, 'mousemove', _this._disableDelayedDrag);
					_on(ownerDocument, 'touchmove', _this._disableDelayedDrag);

					_this._dragStartTimer = setTimeout(dragStartFn, options.delay);
				} else {
					dragStartFn();
				}
			}
		},

		_disableDelayedDrag: function () {
			var ownerDocument = this.el.ownerDocument;

			clearTimeout(this._dragStartTimer);
			_off(ownerDocument, 'mouseup', this._disableDelayedDrag);
			_off(ownerDocument, 'touchend', this._disableDelayedDrag);
			_off(ownerDocument, 'touchcancel', this._disableDelayedDrag);
			_off(ownerDocument, 'mousemove', this._disableDelayedDrag);
			_off(ownerDocument, 'touchmove', this._disableDelayedDrag);
		},

		_triggerDragStart: function (/** Touch */touch) {
			if (touch) {
				// Touch device support
				tapEvt = {
					target: dragEl,
					clientX: touch.clientX,
					clientY: touch.clientY
				};

				this._onDragStart(tapEvt, 'touch');
			}
			else if (!this.nativeDraggable) {
				this._onDragStart(tapEvt, true);
			}
			else {
				_on(dragEl, 'dragend', this);
				_on(rootEl, 'dragstart', this._onDragStart);
			}

			try {
				if (document.selection) {
					document.selection.empty();
				} else {
					window.getSelection().removeAllRanges();
				}
			} catch (err) {
			}
		},

		_dragStarted: function () {
			if (rootEl && dragEl) {
				// Apply effect
				_toggleClass(dragEl, this.options.ghostClass, true);

				Sortable.active = this;

				// Drag start event
				_dispatchEvent(this, rootEl, 'start', dragEl, rootEl, oldIndex);
			}
		},

		_emulateDragOver: function () {
			if (touchEvt) {
				if (this._lastX === touchEvt.clientX && this._lastY === touchEvt.clientY) {
					return;
				}

				this._lastX = touchEvt.clientX;
				this._lastY = touchEvt.clientY;

				if (!supportCssPointerEvents) {
					_css(ghostEl, 'display', 'none');
				}

				var target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY),
					parent = target,
					groupName = ' ' + this.options.group.name + '',
					i = touchDragOverListeners.length;

				if (parent) {
					do {
						if (parent[expando] && parent[expando].options.groups.indexOf(groupName) > -1) {
							while (i--) {
								touchDragOverListeners[i]({
									clientX: touchEvt.clientX,
									clientY: touchEvt.clientY,
									target: target,
									rootEl: parent
								});
							}

							break;
						}

						target = parent; // store last element
					}
					/* jshint boss:true */
					while (parent = parent.parentNode);
				}

				if (!supportCssPointerEvents) {
					_css(ghostEl, 'display', '');
				}
			}
		},


		_onTouchMove: function (/**TouchEvent*/evt) {
			if (tapEvt) {
				// only set the status to dragging, when we are actually dragging
				if (!Sortable.active) {
					this._dragStarted();
				}

				// as well as creating the ghost element on the document body
				this._appendGhost();

				var touch = evt.touches ? evt.touches[0] : evt,
					dx = touch.clientX - tapEvt.clientX,
					dy = touch.clientY - tapEvt.clientY,
					translate3d = evt.touches ? 'translate3d(' + dx + 'px,' + dy + 'px,0)' : 'translate(' + dx + 'px,' + dy + 'px)';

				moved = true;
				touchEvt = touch;

				_css(ghostEl, 'webkitTransform', translate3d);
				_css(ghostEl, 'mozTransform', translate3d);
				_css(ghostEl, 'msTransform', translate3d);
				_css(ghostEl, 'transform', translate3d);

				evt.preventDefault();
			}
		},

		_appendGhost: function () {
			if (!ghostEl) {
				var rect = dragEl.getBoundingClientRect(),
					css = _css(dragEl),
					options = this.options,
					ghostRect;

				ghostEl = dragEl.cloneNode(true);

				_toggleClass(ghostEl, options.ghostClass, false);
				_toggleClass(ghostEl, options.fallbackClass, true);

				_css(ghostEl, 'top', rect.top - parseInt(css.marginTop, 10));
				_css(ghostEl, 'left', rect.left - parseInt(css.marginLeft, 10));
				_css(ghostEl, 'width', rect.width);
				_css(ghostEl, 'height', rect.height);
				_css(ghostEl, 'opacity', '0.8');
				_css(ghostEl, 'position', 'fixed');
				_css(ghostEl, 'zIndex', '100000');
				_css(ghostEl, 'pointerEvents', 'none');

				options.fallbackOnBody && document.body.appendChild(ghostEl) || rootEl.appendChild(ghostEl);

				// Fixing dimensions.
				ghostRect = ghostEl.getBoundingClientRect();
				_css(ghostEl, 'width', rect.width * 2 - ghostRect.width);
				_css(ghostEl, 'height', rect.height * 2 - ghostRect.height);
			}
		},

		_onDragStart: function (/**Event*/evt, /**boolean*/useFallback) {
			var dataTransfer = evt.dataTransfer,
				options = this.options;

			this._offUpEvents();

			if (activeGroup.pull == 'clone') {
				cloneEl = dragEl.cloneNode(true);
				_css(cloneEl, 'display', 'none');
				rootEl.insertBefore(cloneEl, dragEl);
			}

			if (useFallback) {

				if (useFallback === 'touch') {
					// Bind touch events
					_on(document, 'touchmove', this._onTouchMove);
					_on(document, 'touchend', this._onDrop);
					_on(document, 'touchcancel', this._onDrop);
				} else {
					// Old brwoser
					_on(document, 'mousemove', this._onTouchMove);
					_on(document, 'mouseup', this._onDrop);
				}

				this._loopId = setInterval(this._emulateDragOver, 50);
			}
			else {
				if (dataTransfer) {
					dataTransfer.effectAllowed = 'move';
					options.setData && options.setData.call(this, dataTransfer, dragEl);
				}

				_on(document, 'drop', this);
				setTimeout(this._dragStarted, 0);
			}
		},

		_onDragOver: function (/**Event*/evt) {
			var el = this.el,
				target,
				dragRect,
				revert,
				options = this.options,
				group = options.group,
				groupPut = group.put,
				isOwner = (activeGroup === group),
				canSort = options.sort;

			if (evt.preventDefault !== void 0) {
				evt.preventDefault();
				!options.dragoverBubble && evt.stopPropagation();
			}

			moved = true;

			_dispatchEvent(this, rootEl, 'over', dragEl, rootEl, evt, evt.target);

			if (activeGroup && !options.disabled &&
				(isOwner
					? canSort || (revert = !rootEl.contains(dragEl)) // Reverting item into the original list
					: activeGroup.pull && groupPut && (
						(activeGroup.name === group.name) || // by Name
						(groupPut.indexOf && ~groupPut.indexOf(activeGroup.name)) // by Array
					)
				) &&
				(evt.rootEl === void 0 || evt.rootEl === this.el) // touch fallback
			) {
				// Smart auto-scrolling
				_autoScroll(evt, options, this.el);

				if (_silent) {
					return;
				}

				target = _closest(evt.target, options.draggable, el);
				dragRect = dragEl.getBoundingClientRect();

				if (revert) {
					_cloneHide(true);

					if (cloneEl || nextEl) {
						rootEl.insertBefore(dragEl, cloneEl || nextEl);
					}
					else if (!canSort) {
						rootEl.appendChild(dragEl);
					}

					return;
				}


				if ((el.children.length === 0) || (el.children[0] === ghostEl) ||
					(el === evt.target) && (target = _ghostIsLast(el, evt))
				) {

					if (target) {
						if (target.animated) {
							return;
						}

						targetRect = target.getBoundingClientRect();
					}

					_cloneHide(isOwner);

					if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect) !== false) {
						if (!dragEl.contains(el)) {
							el.appendChild(dragEl);
							parentEl = el; // actualization
						}

						this._animate(dragRect, dragEl);
						target && this._animate(targetRect, target);
					}
				}
				else if (target && !target.animated && target !== dragEl && (target.parentNode[expando] !== void 0)) {
					if (lastEl !== target) {
						lastEl = target;
						lastCSS = _css(target);
						lastParentCSS = _css(target.parentNode);
					}


					var targetRect = target.getBoundingClientRect(),
						width = targetRect.right - targetRect.left,
						height = targetRect.bottom - targetRect.top,
						floating = /left|right|inline/.test(lastCSS.cssFloat + lastCSS.display)
							|| (lastParentCSS.display == 'flex' && lastParentCSS['flex-direction'].indexOf('row') === 0),
						isWide = (target.offsetWidth > dragEl.offsetWidth),
						isLong = (target.offsetHeight > dragEl.offsetHeight),
						halfway = (floating ? (evt.clientX - targetRect.left) / width : (evt.clientY - targetRect.top) / height) > 0.5,
						nextSibling = target.nextElementSibling,
						moveVector = _onMove(rootEl, el, dragEl, dragRect, target, targetRect),
						after
					;

					if (moveVector !== false) {
						_silent = true;
						setTimeout(_unsilent, 30);

						_cloneHide(isOwner);

						if (moveVector === 1 || moveVector === -1) {
							after = (moveVector === 1);
						}
						else if (floating) {
							var elTop = dragEl.offsetTop,
								tgTop = target.offsetTop;

							if (elTop === tgTop) {
								after = (target.previousElementSibling === dragEl) && !isWide || halfway && isWide;
							} else {
								after = tgTop > elTop;
							}
						} else {
							after = (nextSibling !== dragEl) && !isLong || halfway && isLong;
						}

						if (!dragEl.contains(el)) {
							if (after && !nextSibling) {
								el.appendChild(dragEl);
							} else {
								target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
							}
						}

						parentEl = dragEl.parentNode; // actualization

						this._animate(dragRect, dragEl);
						this._animate(targetRect, target);
					}
				}
			}
		},

		_animate: function (prevRect, target) {
			var ms = this.options.animation;

			if (ms) {
				var currentRect = target.getBoundingClientRect();

				_css(target, 'transition', 'none');
				_css(target, 'transform', 'translate3d('
					+ (prevRect.left - currentRect.left) + 'px,'
					+ (prevRect.top - currentRect.top) + 'px,0)'
				);

				target.offsetWidth; // repaint

				_css(target, 'transition', 'all ' + ms + 'ms');
				_css(target, 'transform', 'translate3d(0,0,0)');

				clearTimeout(target.animated);
				target.animated = setTimeout(function () {
					_css(target, 'transition', '');
					_css(target, 'transform', '');
					target.animated = false;
				}, ms);
			}
		},

		_offUpEvents: function () {
			var ownerDocument = this.el.ownerDocument;

			_off(document, 'touchmove', this._onTouchMove);
			_off(ownerDocument, 'mouseup', this._onDrop);
			_off(ownerDocument, 'touchend', this._onDrop);
			_off(ownerDocument, 'touchcancel', this._onDrop);
		},

		_onDrop: function (/**Event*/evt) {
			var el = this.el,
				options = this.options;

			clearInterval(this._loopId);
			clearInterval(autoScroll.pid);
			clearTimeout(this._dragStartTimer);

			// Unbind events
			_off(document, 'mousemove', this._onTouchMove);

			if (this.nativeDraggable) {
				_off(document, 'drop', this);
				_off(el, 'dragstart', this._onDragStart);
			}

			this._offUpEvents();

			if (evt) {
				if (moved) {
					evt.preventDefault();
					!options.dropBubble && evt.stopPropagation();
				}

				ghostEl && ghostEl.parentNode.removeChild(ghostEl);

				if (dragEl) {
					if (this.nativeDraggable) {
						_off(dragEl, 'dragend', this);
					}

					_disableDraggable(dragEl);

					// Remove class's
					_toggleClass(dragEl, this.options.ghostClass, false);
					_toggleClass(dragEl, this.options.chosenClass, false);

					if (rootEl !== parentEl) {
						newIndex = _index(dragEl);

						if (newIndex >= 0) {
							// drag from one list and drop into another
							_dispatchEvent(null, parentEl, 'sort', dragEl, rootEl, oldIndex, newIndex);
							_dispatchEvent(this, rootEl, 'sort', dragEl, rootEl, oldIndex, newIndex);

							// Add event
							_dispatchEvent(null, parentEl, 'add', dragEl, rootEl, oldIndex, newIndex);

							// Remove event
							_dispatchEvent(this, rootEl, 'remove', dragEl, rootEl, oldIndex, newIndex);
						}
					}
					else {
						// Remove clone
						cloneEl && cloneEl.parentNode.removeChild(cloneEl);

						if (dragEl.nextSibling !== nextEl) {
							// Get the index of the dragged element within its parent
							newIndex = _index(dragEl);

							if (newIndex >= 0) {
								// drag & drop within the same list
								_dispatchEvent(this, rootEl, 'update', dragEl, rootEl, oldIndex, newIndex);
								_dispatchEvent(this, rootEl, 'sort', dragEl, rootEl, oldIndex, newIndex);
							}
						}
					}

					if (Sortable.active) {
						if (newIndex === null || newIndex === -1) {
							newIndex = oldIndex;
						}

						this.originalEvent = evt;
						_dispatchEvent(this, rootEl, 'end', dragEl, rootEl, oldIndex, newIndex);

						// Save sorting
						this.save();
					}
				}

				// Nulling
				rootEl =
				dragEl =
				parentEl =
				ghostEl =
				nextEl =
				cloneEl =

				scrollEl =
				scrollParentEl =

				tapEvt =
				touchEvt =

				moved =
				newIndex =

				lastEl =
				lastCSS =

				activeGroup =
				Sortable.active = null;
			}
		},


		handleEvent: function (/**Event*/evt) {
			var type = evt.type;

			if (type === 'dragover' || type === 'dragenter') {
				if (dragEl) {
					this._onDragOver(evt);
					_globalDragOver(evt);
				}
			}
			else if (type === 'drop' || type === 'dragend') {
				this._onDrop(evt);
			}
		},


		/**
		 * Serializes the item into an array of string.
		 * @returns {String[]}
		 */
		toArray: function () {
			var order = [],
				el,
				children = this.el.children,
				i = 0,
				n = children.length,
				options = this.options;

			for (; i < n; i++) {
				el = children[i];
				if (_closest(el, options.draggable, this.el)) {
					order.push(el.getAttribute(options.dataIdAttr) || _generateId(el));
				}
			}

			return order;
		},


		/**
		 * Sorts the elements according to the array.
		 * @param  {String[]}  order  order of the items
		 */
		sort: function (order) {
			var items = {}, rootEl = this.el;

			this.toArray().forEach(function (id, i) {
				var el = rootEl.children[i];

				if (_closest(el, this.options.draggable, rootEl)) {
					items[id] = el;
				}
			}, this);

			order.forEach(function (id) {
				if (items[id]) {
					rootEl.removeChild(items[id]);
					rootEl.appendChild(items[id]);
				}
			});
		},


		/**
		 * Save the current sorting
		 */
		save: function () {
			var store = this.options.store;
			store && store.set(this);
		},


		/**
		 * For each element in the set, get the first element that matches the selector by testing the element itself and traversing up through its ancestors in the DOM tree.
		 * @param   {HTMLElement}  el
		 * @param   {String}       [selector]  default: `options.draggable`
		 * @returns {HTMLElement|null}
		 */
		closest: function (el, selector) {
			return _closest(el, selector || this.options.draggable, this.el);
		},


		/**
		 * Set/get option
		 * @param   {string} name
		 * @param   {*}      [value]
		 * @returns {*}
		 */
		option: function (name, value) {
			var options = this.options;

			if (value === void 0) {
				return options[name];
			} else {
				options[name] = value;

				if (name === 'group') {
					_prepareGroup(options);
				}
			}
		},


		/**
		 * Destroy
		 */
		destroy: function () {
			var el = this.el;

			el[expando] = null;

			_off(el, 'mousedown', this._onTapStart);
			_off(el, 'touchstart', this._onTapStart);

			if (this.nativeDraggable) {
				_off(el, 'dragover', this);
				_off(el, 'dragenter', this);
			}

			// Remove draggable attributes
			Array.prototype.forEach.call(el.querySelectorAll('[draggable]'), function (el) {
				el.removeAttribute('draggable');
			});

			touchDragOverListeners.splice(touchDragOverListeners.indexOf(this._onDragOver), 1);

			this._onDrop();

			this.el = el = null;
		}
	};


	function _cloneHide(state) {
		if (cloneEl && (cloneEl.state !== state)) {
			_css(cloneEl, 'display', state ? 'none' : '');
			!state && cloneEl.state && rootEl.insertBefore(cloneEl, dragEl);
			cloneEl.state = state;
		}
	}


	function _closest(/**HTMLElement*/el, /**String*/selector, /**HTMLElement*/ctx) {
		if (el) {
			ctx = ctx || document;
			selector = selector.split('.');

			var tag = selector.shift().toUpperCase(),
				re = new RegExp('\\s(' + selector.join('|') + ')(?=\\s)', 'g');

			do {
				if (
					(tag === '>*' && el.parentNode === ctx) || (
						(tag === '' || el.nodeName.toUpperCase() == tag) &&
						(!selector.length || ((' ' + el.className + ' ').match(re) || []).length == selector.length)
					)
				) {
					return el;
				}
			}
			while (el !== ctx && (el = el.parentNode));
		}

		return null;
	}


	function _globalDragOver(/**Event*/evt) {
		if (evt.dataTransfer) {
			evt.dataTransfer.dropEffect = 'move';
		}
		evt.preventDefault();
	}


	function _on(el, event, fn) {
		el.addEventListener(event, fn, false);
	}


	function _off(el, event, fn) {
		el.removeEventListener(event, fn, false);
	}


	function _toggleClass(el, name, state) {
		if (el) {
			if (el.classList) {
				el.classList[state ? 'add' : 'remove'](name);
			}
			else {
				var className = (' ' + el.className + ' ').replace(RSPACE, ' ').replace(' ' + name + ' ', ' ');
				el.className = (className + (state ? ' ' + name : '')).replace(RSPACE, ' ');
			}
		}
	}


	function _css(el, prop, val) {
		var style = el && el.style;

		if (style) {
			if (val === void 0) {
				if (document.defaultView && document.defaultView.getComputedStyle) {
					val = document.defaultView.getComputedStyle(el, '');
				}
				else if (el.currentStyle) {
					val = el.currentStyle;
				}

				return prop === void 0 ? val : val[prop];
			}
			else {
				if (!(prop in style)) {
					prop = '-webkit-' + prop;
				}

				style[prop] = val + (typeof val === 'string' ? '' : 'px');
			}
		}
	}


	function _find(ctx, tagName, iterator) {
		if (ctx) {
			var list = ctx.getElementsByTagName(tagName), i = 0, n = list.length;

			if (iterator) {
				for (; i < n; i++) {
					iterator(list[i], i);
				}
			}

			return list;
		}

		return [];
	}



	function _dispatchEvent(sortable, rootEl, name, targetEl, fromEl, startIndex, newIndex) {
		var evt = document.createEvent('Event'),
			options = (sortable || rootEl[expando]).options,
			onName = 'on' + name.charAt(0).toUpperCase() + name.substr(1);

		evt.initEvent(name, true, true);

		evt.to = rootEl;
		evt.from = fromEl || rootEl;
		evt.item = targetEl || rootEl;
		evt.clone = cloneEl;

		evt.oldIndex = startIndex;
		evt.newIndex = newIndex;

		rootEl.dispatchEvent(evt);

		if (options[onName]) {
			options[onName].call(sortable, evt);
		}
	}


	function _onMove(fromEl, toEl, dragEl, dragRect, targetEl, targetRect) {
		var evt,
			sortable = fromEl[expando],
			onMoveFn = sortable.options.onMove,
			retVal;

		evt = document.createEvent('Event');
		evt.initEvent('move', true, true);

		evt.to = toEl;
		evt.from = fromEl;
		evt.dragged = dragEl;
		evt.draggedRect = dragRect;
		evt.related = targetEl || toEl;
		evt.relatedRect = targetRect || toEl.getBoundingClientRect();

		fromEl.dispatchEvent(evt);

		if (onMoveFn) {
			retVal = onMoveFn.call(sortable, evt);
		}

		return retVal;
	}


	function _disableDraggable(el) {
		el.draggable = false;
	}


	function _unsilent() {
		_silent = false;
	}


	/** @returns {HTMLElement|false} */
	function _ghostIsLast(el, evt) {
		var lastEl = el.lastElementChild,
				rect = lastEl.getBoundingClientRect();

		return ((evt.clientY - (rect.top + rect.height) > 5) || (evt.clientX - rect.right > 5)) && lastEl; // min delta
	}


	/**
	 * Generate id
	 * @param   {HTMLElement} el
	 * @returns {String}
	 * @private
	 */
	function _generateId(el) {
		var str = el.tagName + el.className + el.src + el.href + el.textContent,
			i = str.length,
			sum = 0;

		while (i--) {
			sum += str.charCodeAt(i);
		}

		return sum.toString(36);
	}

	/**
	 * Returns the index of an element within its parent
	 * @param  {HTMLElement} el
	 * @return {number}
	 */
	function _index(el) {
		var index = 0;

		if (!el || !el.parentNode) {
			return -1;
		}

		while (el && (el = el.previousElementSibling)) {
			if (el.nodeName.toUpperCase() !== 'TEMPLATE') {
				index++;
			}
		}

		return index;
	}

	function _throttle(callback, ms) {
		var args, _this;

		return function () {
			if (args === void 0) {
				args = arguments;
				_this = this;

				setTimeout(function () {
					if (args.length === 1) {
						callback.call(_this, args[0]);
					} else {
						callback.apply(_this, args);
					}

					args = void 0;
				}, ms);
			}
		};
	}

	function _extend(dst, src) {
		if (dst && src) {
			for (var key in src) {
				if (src.hasOwnProperty(key)) {
					dst[key] = src[key];
				}
			}
		}

		return dst;
	}


	// Export utils
	Sortable.utils = {
		on: _on,
		off: _off,
		css: _css,
		find: _find,
		is: function (el, selector) {
			return !!_closest(el, selector, el);
		},
		extend: _extend,
		throttle: _throttle,
		closest: _closest,
		toggleClass: _toggleClass,
		index: _index
	};


	/**
	 * Create sortable instance
	 * @param {HTMLElement}  el
	 * @param {Object}      [options]
	 */
	Sortable.create = function (el, options) {
		return new Sortable(el, options);
	};


	// Export
	Sortable.version = '1.3.0';
	return Sortable;
});

},{}],274:[function(require,module,exports){
/* Web Font Loader v1.6.16 - (c) Adobe Systems, Google. License: Apache 2.0 */
(function(){function aa(a,b,c){return a.call.apply(a.bind,arguments)}function ba(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}}function n(a,b,c){n=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?aa:ba;return n.apply(null,arguments)}var p=Date.now||function(){return+new Date};function r(a,b){this.F=a;this.k=b||a;this.H=this.k.document}var ca=!!window.FontFace;r.prototype.createElement=function(a,b,c){a=this.H.createElement(a);if(b)for(var d in b)b.hasOwnProperty(d)&&("style"==d?a.style.cssText=b[d]:a.setAttribute(d,b[d]));c&&a.appendChild(this.H.createTextNode(c));return a};function s(a,b,c){a=a.H.getElementsByTagName(b)[0];a||(a=document.documentElement);a.insertBefore(c,a.lastChild)}
function t(a,b,c){b=b||[];c=c||[];for(var d=a.className.split(/\s+/),e=0;e<b.length;e+=1){for(var f=!1,g=0;g<d.length;g+=1)if(b[e]===d[g]){f=!0;break}f||d.push(b[e])}b=[];for(e=0;e<d.length;e+=1){f=!1;for(g=0;g<c.length;g+=1)if(d[e]===c[g]){f=!0;break}f||b.push(d[e])}a.className=b.join(" ").replace(/\s+/g," ").replace(/^\s+|\s+$/,"")}function u(a,b){for(var c=a.className.split(/\s+/),d=0,e=c.length;d<e;d++)if(c[d]==b)return!0;return!1}
function v(a){if("string"===typeof a.fa)return a.fa;var b=a.k.location.protocol;"about:"==b&&(b=a.F.location.protocol);return"https:"==b?"https:":"http:"}function x(a,b,c){function d(){l&&e&&f&&(l(g),l=null)}b=a.createElement("link",{rel:"stylesheet",href:b,media:"all"});var e=!1,f=!0,g=null,l=c||null;ca?(b.onload=function(){e=!0;d()},b.onerror=function(){e=!0;g=Error("Stylesheet failed to load");d()}):setTimeout(function(){e=!0;d()},0);s(a,"head",b)}
function y(a,b,c,d){var e=a.H.getElementsByTagName("head")[0];if(e){var f=a.createElement("script",{src:b}),g=!1;f.onload=f.onreadystatechange=function(){g||this.readyState&&"loaded"!=this.readyState&&"complete"!=this.readyState||(g=!0,c&&c(null),f.onload=f.onreadystatechange=null,"HEAD"==f.parentNode.tagName&&e.removeChild(f))};e.appendChild(f);setTimeout(function(){g||(g=!0,c&&c(Error("Script load timeout")))},d||5E3);return f}return null};function z(){this.S=0;this.K=null}function A(a){a.S++;return function(){a.S--;B(a)}}function C(a,b){a.K=b;B(a)}function B(a){0==a.S&&a.K&&(a.K(),a.K=null)};function D(a){this.ea=a||"-"}D.prototype.d=function(a){for(var b=[],c=0;c<arguments.length;c++)b.push(arguments[c].replace(/[\W_]+/g,"").toLowerCase());return b.join(this.ea)};function E(a,b){this.Q=a;this.M=4;this.L="n";var c=(b||"n4").match(/^([nio])([1-9])$/i);c&&(this.L=c[1],this.M=parseInt(c[2],10))}E.prototype.getName=function(){return this.Q};function da(a){return F(a)+" "+(a.M+"00")+" 300px "+G(a.Q)}function G(a){var b=[];a=a.split(/,\s*/);for(var c=0;c<a.length;c++){var d=a[c].replace(/['"]/g,"");-1!=d.indexOf(" ")||/^\d/.test(d)?b.push("'"+d+"'"):b.push(d)}return b.join(",")}function I(a){return a.L+a.M}
function F(a){var b="normal";"o"===a.L?b="oblique":"i"===a.L&&(b="italic");return b}function ea(a){var b=4,c="n",d=null;a&&((d=a.match(/(normal|oblique|italic)/i))&&d[1]&&(c=d[1].substr(0,1).toLowerCase()),(d=a.match(/([1-9]00|normal|bold)/i))&&d[1]&&(/bold/i.test(d[1])?b=7:/[1-9]00/.test(d[1])&&(b=parseInt(d[1].substr(0,1),10))));return c+b};function fa(a,b){this.a=a;this.j=a.k.document.documentElement;this.O=b;this.f="wf";this.e=new D("-");this.da=!1!==b.events;this.u=!1!==b.classes}function ga(a){a.u&&t(a.j,[a.e.d(a.f,"loading")]);J(a,"loading")}function K(a){if(a.u){var b=u(a.j,a.e.d(a.f,"active")),c=[],d=[a.e.d(a.f,"loading")];b||c.push(a.e.d(a.f,"inactive"));t(a.j,c,d)}J(a,"inactive")}function J(a,b,c){if(a.da&&a.O[b])if(c)a.O[b](c.getName(),I(c));else a.O[b]()};function ha(){this.t={}}function ia(a,b,c){var d=[],e;for(e in b)if(b.hasOwnProperty(e)){var f=a.t[e];f&&d.push(f(b[e],c))}return d};function L(a,b){this.a=a;this.h=b;this.m=this.a.createElement("span",{"aria-hidden":"true"},this.h)}function M(a,b){var c=a.m,d;d="display:block;position:absolute;top:-9999px;left:-9999px;font-size:300px;width:auto;height:auto;line-height:normal;margin:0;padding:0;font-variant:normal;white-space:nowrap;font-family:"+G(b.Q)+";"+("font-style:"+F(b)+";font-weight:"+(b.M+"00")+";");c.style.cssText=d}function N(a){s(a.a,"body",a.m)}L.prototype.remove=function(){var a=this.m;a.parentNode&&a.parentNode.removeChild(a)};function O(a,b,c,d,e,f){this.G=a;this.J=b;this.g=d;this.a=c;this.v=e||3E3;this.h=f||void 0}O.prototype.start=function(){function a(){p()-d>=c.v?c.J(c.g):b.fonts.load(da(c.g),c.h).then(function(b){1<=b.length?c.G(c.g):setTimeout(a,25)},function(){c.J(c.g)})}var b=this.a.k.document,c=this,d=p();a()};function P(a,b,c,d,e,f,g){this.G=a;this.J=b;this.a=c;this.g=d;this.h=g||"BESbswy";this.s={};this.v=e||3E3;this.Z=f||null;this.D=this.C=this.A=this.w=null;this.w=new L(this.a,this.h);this.A=new L(this.a,this.h);this.C=new L(this.a,this.h);this.D=new L(this.a,this.h);M(this.w,new E(this.g.getName()+",serif",I(this.g)));M(this.A,new E(this.g.getName()+",sans-serif",I(this.g)));M(this.C,new E("serif",I(this.g)));M(this.D,new E("sans-serif",I(this.g)));N(this.w);N(this.A);N(this.C);N(this.D)}
var Q={ia:"serif",ha:"sans-serif"},R=null;function S(){if(null===R){var a=/AppleWebKit\/([0-9]+)(?:\.([0-9]+))/.exec(window.navigator.userAgent);R=!!a&&(536>parseInt(a[1],10)||536===parseInt(a[1],10)&&11>=parseInt(a[2],10))}return R}P.prototype.start=function(){this.s.serif=this.C.m.offsetWidth;this.s["sans-serif"]=this.D.m.offsetWidth;this.ga=p();ja(this)};function ka(a,b,c){for(var d in Q)if(Q.hasOwnProperty(d)&&b===a.s[Q[d]]&&c===a.s[Q[d]])return!0;return!1}
function ja(a){var b=a.w.m.offsetWidth,c=a.A.m.offsetWidth,d;(d=b===a.s.serif&&c===a.s["sans-serif"])||(d=S()&&ka(a,b,c));d?p()-a.ga>=a.v?S()&&ka(a,b,c)&&(null===a.Z||a.Z.hasOwnProperty(a.g.getName()))?T(a,a.G):T(a,a.J):la(a):T(a,a.G)}function la(a){setTimeout(n(function(){ja(this)},a),50)}function T(a,b){setTimeout(n(function(){this.w.remove();this.A.remove();this.C.remove();this.D.remove();b(this.g)},a),0)};function U(a,b,c){this.a=a;this.p=b;this.P=0;this.ba=this.Y=!1;this.v=c}var V=null;U.prototype.V=function(a){var b=this.p;b.u&&t(b.j,[b.e.d(b.f,a.getName(),I(a).toString(),"active")],[b.e.d(b.f,a.getName(),I(a).toString(),"loading"),b.e.d(b.f,a.getName(),I(a).toString(),"inactive")]);J(b,"fontactive",a);this.ba=!0;ma(this)};
U.prototype.W=function(a){var b=this.p;if(b.u){var c=u(b.j,b.e.d(b.f,a.getName(),I(a).toString(),"active")),d=[],e=[b.e.d(b.f,a.getName(),I(a).toString(),"loading")];c||d.push(b.e.d(b.f,a.getName(),I(a).toString(),"inactive"));t(b.j,d,e)}J(b,"fontinactive",a);ma(this)};function ma(a){0==--a.P&&a.Y&&(a.ba?(a=a.p,a.u&&t(a.j,[a.e.d(a.f,"active")],[a.e.d(a.f,"loading"),a.e.d(a.f,"inactive")]),J(a,"active")):K(a.p))};function na(a){this.F=a;this.q=new ha;this.$=0;this.T=this.U=!0}na.prototype.load=function(a){this.a=new r(this.F,a.context||this.F);this.U=!1!==a.events;this.T=!1!==a.classes;oa(this,new fa(this.a,a),a)};
function pa(a,b,c,d,e){var f=0==--a.$;(a.T||a.U)&&setTimeout(function(){var a=e||null,l=d||null||{};if(0===c.length&&f)K(b.p);else{b.P+=c.length;f&&(b.Y=f);var h,k=[];for(h=0;h<c.length;h++){var m=c[h],w=l[m.getName()],q=b.p,H=m;q.u&&t(q.j,[q.e.d(q.f,H.getName(),I(H).toString(),"loading")]);J(q,"fontloading",H);q=null;null===V&&(V=window.FontFace?(q=/Gecko.*Firefox\/(\d+)/.exec(window.navigator.userAgent))?42<parseInt(q[1],10):!0:!1);q=V?new O(n(b.V,b),n(b.W,b),b.a,m,b.v,w):new P(n(b.V,b),n(b.W,b),
b.a,m,b.v,a,w);k.push(q)}for(h=0;h<k.length;h++)k[h].start()}},0)}function oa(a,b,c){var d=[],e=c.timeout;ga(b);var d=ia(a.q,c,a.a),f=new U(a.a,b,e);a.$=d.length;b=0;for(c=d.length;b<c;b++)d[b].load(function(b,c,d){pa(a,f,b,c,d)})};function qa(a,b,c){this.N=a?a:b+ra;this.o=[];this.R=[];this.ca=c||""}var ra="//fonts.googleapis.com/css";function sa(a,b){for(var c=b.length,d=0;d<c;d++){var e=b[d].split(":");3==e.length&&a.R.push(e.pop());var f="";2==e.length&&""!=e[1]&&(f=":");a.o.push(e.join(f))}}
qa.prototype.d=function(){if(0==this.o.length)throw Error("No fonts to load!");if(-1!=this.N.indexOf("kit="))return this.N;for(var a=this.o.length,b=[],c=0;c<a;c++)b.push(this.o[c].replace(/ /g,"+"));a=this.N+"?family="+b.join("%7C");0<this.R.length&&(a+="&subset="+this.R.join(","));0<this.ca.length&&(a+="&text="+encodeURIComponent(this.ca));return a};function ta(a){this.o=a;this.aa=[];this.I={}}
var ua={latin:"BESbswy",cyrillic:"&#1081;&#1103;&#1046;",greek:"&#945;&#946;&#931;",khmer:"&#x1780;&#x1781;&#x1782;",Hanuman:"&#x1780;&#x1781;&#x1782;"},va={thin:"1",extralight:"2","extra-light":"2",ultralight:"2","ultra-light":"2",light:"3",regular:"4",book:"4",medium:"5","semi-bold":"6",semibold:"6","demi-bold":"6",demibold:"6",bold:"7","extra-bold":"8",extrabold:"8","ultra-bold":"8",ultrabold:"8",black:"9",heavy:"9",l:"3",r:"4",b:"7"},wa={i:"i",italic:"i",n:"n",normal:"n"},xa=/^(thin|(?:(?:extra|ultra)-?)?light|regular|book|medium|(?:(?:semi|demi|extra|ultra)-?)?bold|black|heavy|l|r|b|[1-9]00)?(n|i|normal|italic)?$/;
ta.prototype.parse=function(){for(var a=this.o.length,b=0;b<a;b++){var c=this.o[b].split(":"),d=c[0].replace(/\+/g," "),e=["n4"];if(2<=c.length){var f;var g=c[1];f=[];if(g)for(var g=g.split(","),l=g.length,h=0;h<l;h++){var k;k=g[h];if(k.match(/^[\w-]+$/))if(k=xa.exec(k.toLowerCase()),null==k)k="";else{var m;m=k[1];if(null==m||""==m)m="4";else{var w=va[m];m=w?w:isNaN(m)?"4":m.substr(0,1)}k=k[2];k=[null==k||""==k?"n":wa[k],m].join("")}else k="";k&&f.push(k)}0<f.length&&(e=f);3==c.length&&(c=c[2],f=
[],c=c?c.split(","):f,0<c.length&&(c=ua[c[0]])&&(this.I[d]=c))}this.I[d]||(c=ua[d])&&(this.I[d]=c);for(c=0;c<e.length;c+=1)this.aa.push(new E(d,e[c]))}};function ya(a,b){this.a=a;this.c=b}var za={Arimo:!0,Cousine:!0,Tinos:!0};ya.prototype.load=function(a){var b=new z,c=this.a,d=new qa(this.c.api,v(c),this.c.text),e=this.c.families;sa(d,e);var f=new ta(e);f.parse();x(c,d.d(),A(b));C(b,function(){a(f.aa,f.I,za)})};function W(a,b){this.a=a;this.c=b;this.X=[]}W.prototype.B=function(a){var b=this.a;return v(this.a)+(this.c.api||"//f.fontdeck.com/s/css/js/")+(b.k.location.hostname||b.F.location.hostname)+"/"+a+".js"};
W.prototype.load=function(a){var b=this.c.id,c=this.a.k,d=this;b?(c.__webfontfontdeckmodule__||(c.__webfontfontdeckmodule__={}),c.__webfontfontdeckmodule__[b]=function(b,c){for(var g=0,l=c.fonts.length;g<l;++g){var h=c.fonts[g];d.X.push(new E(h.name,ea("font-weight:"+h.weight+";font-style:"+h.style)))}a(d.X)},y(this.a,this.B(b),function(b){b&&a([])})):a([])};function X(a,b){this.a=a;this.c=b}X.prototype.B=function(a){return(this.c.api||"https://use.typekit.net")+"/"+a+".js"};X.prototype.load=function(a){var b=this.c.id,c=this.a.k;b?y(this.a,this.B(b),function(b){if(b)a([]);else if(c.Typekit&&c.Typekit.config&&c.Typekit.config.fn){b=c.Typekit.config.fn;for(var e=[],f=0;f<b.length;f+=2)for(var g=b[f],l=b[f+1],h=0;h<l.length;h++)e.push(new E(g,l[h]));try{c.Typekit.load({events:!1,classes:!1,async:!0})}catch(k){}a(e)}},2E3):a([])};function Y(a,b){this.a=a;this.c=b}Y.prototype.B=function(a,b){var c=v(this.a),d=(this.c.api||"fast.fonts.net/jsapi").replace(/^.*http(s?):(\/\/)?/,"");return c+"//"+d+"/"+a+".js"+(b?"?v="+b:"")};
Y.prototype.load=function(a){function b(){if(e["__mti_fntLst"+c]){var d=e["__mti_fntLst"+c](),g=[],l;if(d)for(var h=0;h<d.length;h++){var k=d[h].fontfamily;void 0!=d[h].fontStyle&&void 0!=d[h].fontWeight?(l=d[h].fontStyle+d[h].fontWeight,g.push(new E(k,l))):g.push(new E(k))}a(g)}else setTimeout(function(){b()},50)}var c=this.c.projectId,d=this.c.version;if(c){var e=this.a.k;y(this.a,this.B(c,d),function(c){c?a([]):b()}).id="__MonotypeAPIScript__"+c}else a([])};function Aa(a,b){this.a=a;this.c=b}Aa.prototype.load=function(a){var b,c,d=this.c.urls||[],e=this.c.families||[],f=this.c.testStrings||{},g=new z;b=0;for(c=d.length;b<c;b++)x(this.a,d[b],A(g));var l=[];b=0;for(c=e.length;b<c;b++)if(d=e[b].split(":"),d[1])for(var h=d[1].split(","),k=0;k<h.length;k+=1)l.push(new E(d[0],h[k]));else l.push(new E(d[0]));C(g,function(){a(l,f)})};var Z=new na(window);Z.q.t.custom=function(a,b){return new Aa(b,a)};Z.q.t.fontdeck=function(a,b){return new W(b,a)};Z.q.t.monotype=function(a,b){return new Y(b,a)};Z.q.t.typekit=function(a,b){return new X(b,a)};Z.q.t.google=function(a,b){return new ya(b,a)};var $={load:n(Z.load,Z)};"function"===typeof define&&define.amd?define(function(){return $}):"undefined"!==typeof module&&module.exports?module.exports=$:(window.WebFont=$,window.WebFontConfig&&Z.load(window.WebFontConfig));}());


},{}],"ext/tooltips":[function(require,module,exports){
/*!
 * tooltips 0.1.0 - 20th Dec 2013
 * https://github.com/darsain/tooltip
 *
 * Licensed under the MIT license.
 * http://opensource.org/licenses/MIT
 *
 * @modified by Djamil Legato
 */
;(function(){

    /**
     * Require the given path.
     *
     * @param {String} path
     * @return {Object} exports
     * @api public
     */

    function fakeRequire(path, parent, orig) {
        var resolved = fakeRequire.resolve(path);

        // lookup failed
        if (null == resolved) {
            orig = orig || path;
            parent = parent || 'root';
            var err = new Error('Failed to fakeRequire "' + orig + '" from "' + parent + '"');
            err.path = orig;
            err.parent = parent;
            err.fakeRequire = true;
            throw err;
        }

        var module = fakeRequire.modules[resolved];

        // perform real fakeRequire()
        // by invoking the module's
        // registered function
        if (!module._resolving && !module.exports) {
            var mod = {};
            mod.exports = {};
            mod.client = mod.component = true;
            module._resolving = true;
            module.call(this, mod.exports, fakeRequire.relative(resolved), mod);
            delete module._resolving;
            module.exports = mod.exports;
        }

        return module.exports;
    }

    /**
     * Registered modules.
     */

    fakeRequire.modules = {};

    /**
     * Registered aliases.
     */

    fakeRequire.aliases = {};

    /**
     * Resolve `path`.
     *
     * Lookup:
     *
     *   - PATH/index.js
     *   - PATH.js
     *   - PATH
     *
     * @param {String} path
     * @return {String} path or null
     * @api private
     */

    fakeRequire.resolve = function(path) {
        if (path.charAt(0) === '/') path = path.slice(1);

        var paths = [
            path,
            path + '.js',
            path + '.json',
            path + '/index.js',
            path + '/index.json'
        ];

        for (var i = 0; i < paths.length; i++) {
            var path = paths[i];
            if (fakeRequire.modules.hasOwnProperty(path)) return path;
            if (fakeRequire.aliases.hasOwnProperty(path)) return fakeRequire.aliases[path];
        }
    };

    /**
     * Normalize `path` relative to the current path.
     *
     * @param {String} curr
     * @param {String} path
     * @return {String}
     * @api private
     */

    fakeRequire.normalize = function(curr, path) {
        var segs = [];

        if ('.' != path.charAt(0)) return path;

        curr = curr.split('/');
        path = path.split('/');

        for (var i = 0; i < path.length; ++i) {
            if ('..' == path[i]) {
                curr.pop();
            } else if ('.' != path[i] && '' != path[i]) {
                segs.push(path[i]);
            }
        }

        return curr.concat(segs).join('/');
    };

    /**
     * Register module at `path` with callback `definition`.
     *
     * @param {String} path
     * @param {Function} definition
     * @api private
     */

    fakeRequire.register = function(path, definition) {
        fakeRequire.modules[path] = definition;
    };

    /**
     * Alias a module definition.
     *
     * @param {String} from
     * @param {String} to
     * @api private
     */

    fakeRequire.alias = function(from, to) {
        if (!fakeRequire.modules.hasOwnProperty(from)) {
            throw new Error('Failed to alias "' + from + '", it does not exist');
        }
        fakeRequire.aliases[to] = from;
    };

    /**
     * Return a fakeRequire function relative to the `parent` path.
     *
     * @param {String} parent
     * @return {Function}
     * @api private
     */

    fakeRequire.relative = function(parent) {
        var p = fakeRequire.normalize(parent, '..');

        /**
         * lastIndexOf helper.
         */

        function lastIndexOf(arr, obj) {
            var i = arr.length;
            while (i--) {
                if (arr[i] === obj) return i;
            }
            return -1;
        }

        /**
         * The relative fakeRequire() itself.
         */

        function localRequire(path) {
            var resolved = localRequire.resolve(path);
            return fakeRequire(resolved, parent, path);
        }

        /**
         * Resolve relative to the parent.
         */

        localRequire.resolve = function(path) {
            var c = path.charAt(0);
            if ('/' == c) return path.slice(1);
            if ('.' == c) return fakeRequire.normalize(p, path);

            // resolve deps by returning
            // the dep in the nearest "deps"
            // directory
            var segs = parent.split('/');
            var i = lastIndexOf(segs, 'deps') + 1;
            if (!i) i = 0;
            path = segs.slice(0, i + 1).join('/') + '/deps/' + path;
            return path;
        };

        /**
         * Check if module is defined at `path`.
         */

        localRequire.exists = function(path) {
            return fakeRequire.modules.hasOwnProperty(localRequire.resolve(path));
        };

        return localRequire;
    };
    fakeRequire.register("darsain-position/index.js", Function("exports, fakeRequire, module",
        "'use strict';\n\
        \n\
        /**\n\
         * Transport.\n\
         */\n\
        module.exports = position;\n\
        \n\
        /**\n\
         * Globals.\n\
         */\n\
        var win = window;\n\
        var doc = win.document;\n\
        var docEl = doc.documentElement;\n\
        \n\
        /**\n\
         * Poor man's shallow object extend.\n\
         *\n\
         * @param {Object} a\n\
         * @param {Object} b\n\
         *\n\
         * @return {Object}\n\
         */\n\
        function extend(a, b) {\n\
        \tfor (var key in b) {\n\
        \t\ta[key] = b[key];\n\
        \t}\n\
        \treturn a;\n\
        }\n\
        \n\
        /**\n\
         * Checks whether object is window.\n\
         *\n\
         * @param {Object} obj\n\
         *\n\
         * @return {Boolean}\n\
         */\n\
        function isWin(obj) {\n\
        \treturn obj && obj.setInterval != null;\n\
        }\n\
        \n\
        /**\n\
         * Returns element's object with `left`, `top`, `bottom`, `right`, `width`, and `height`\n\
         * properties indicating the position and dimensions of element on a page.\n\
         *\n\
         * @param {Element} element\n\
         *\n\
         * @return {Object}\n\
         */\n\
        function position(element) {\n\
        \tvar winTop = win.pageYOffset || docEl.scrollTop;\n\
        \tvar winLeft = win.pageXOffset || docEl.scrollLeft;\n\
        \tvar box = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };\n\
        \n\
        \tif (isWin(element)) {\n\
        \t\tbox.width = win.innerWidth || docEl.clientWidth;\n\
        \t\tbox.height = win.innerHeight || docEl.clientHeight;\n\
        \t} else if (docEl.contains(element) && element.getBoundingClientRect != null) {\n\
        \t\textend(box, element.getBoundingClientRect());\n\
        \t\t// width & height don't exist in <IE9\n\
        \t\tbox.width = box.right - box.left;\n\
        \t\tbox.height = box.bottom - box.top;\n\
        \t} else {\n\
        \t\treturn box;\n\
        \t}\n\
        \n\
        \tbox.top = box.top + winTop - docEl.clientTop;\n\
        \tbox.left = box.left + winLeft - docEl.clientLeft;\n\
        \tbox.right = box.left + box.width;\n\
        \tbox.bottom = box.top + box.height;\n\
        \n\
        \treturn box;\n\
        }//@ sourceURL=darsain-position/index.js"
    ));
    fakeRequire.register("component-classes/index.js", Function("exports, fakeRequire, module",
        "/**\n\
         * Module dependencies.\n\
         */\n\
        \n\
        var index = fakeRequire('indexof');\n\
        \n\
        /**\n\
         * Whitespace regexp.\n\
         */\n\
        \n\
        var re = /\\s+/;\n\
        \n\
        /**\n\
         * toString reference.\n\
         */\n\
        \n\
        var toString = Object.prototype.toString;\n\
        \n\
        /**\n\
         * Wrap `el` in a `ClassList`.\n\
         *\n\
         * @param {Element} el\n\
         * @return {ClassList}\n\
         * @api public\n\
         */\n\
        \n\
        module.exports = function(el){\n\
          return new ClassList(el);\n\
        };\n\
        \n\
        /**\n\
         * Initialize a new ClassList for `el`.\n\
         *\n\
         * @param {Element} el\n\
         * @api private\n\
         */\n\
        \n\
        function ClassList(el) {\n\
          if (!el) throw new Error('A DOM element reference is fakeRequired');\n\
          this.el = el;\n\
          this.list = el.classList;\n\
        }\n\
        \n\
        /**\n\
         * Add class `name` if not already present.\n\
         *\n\
         * @param {String} name\n\
         * @return {ClassList}\n\
         * @api public\n\
         */\n\
        \n\
        ClassList.prototype.add = function(name){\n\
          // classList\n\
          if (this.list) {\n\
            this.list.add(name);\n\
            return this;\n\
          }\n\
        \n\
          // fallback\n\
          var arr = this.array();\n\
          var i = index(arr, name);\n\
          if (!~i) arr.push(name);\n\
          this.el.className = arr.join(' ');\n\
          return this;\n\
        };\n\
        \n\
        /**\n\
         * Remove class `name` when present, or\n\
         * pass a regular expression to remove\n\
         * any which match.\n\
         *\n\
         * @param {String|RegExp} name\n\
         * @return {ClassList}\n\
         * @api public\n\
         */\n\
        \n\
        ClassList.prototype.remove = function(name){\n\
          if ('[object RegExp]' == toString.call(name)) {\n\
            return this.removeMatching(name);\n\
          }\n\
        \n\
          // classList\n\
          if (this.list) {\n\
            this.list.remove(name);\n\
            return this;\n\
          }\n\
        \n\
          // fallback\n\
          var arr = this.array();\n\
          var i = index(arr, name);\n\
          if (~i) arr.splice(i, 1);\n\
          this.el.className = arr.join(' ');\n\
          return this;\n\
        };\n\
        \n\
        /**\n\
         * Remove all classes matching `re`.\n\
         *\n\
         * @param {RegExp} re\n\
         * @return {ClassList}\n\
         * @api private\n\
         */\n\
        \n\
        ClassList.prototype.removeMatching = function(re){\n\
          var arr = this.array();\n\
          for (var i = 0; i < arr.length; i++) {\n\
            if (re.test(arr[i])) {\n\
              this.remove(arr[i]);\n\
            }\n\
          }\n\
          return this;\n\
        };\n\
        \n\
        /**\n\
         * Toggle class `name`.\n\
         *\n\
         * @param {String} name\n\
         * @return {ClassList}\n\
         * @api public\n\
         */\n\
        \n\
        ClassList.prototype.toggle = function(name){\n\
          // classList\n\
          if (this.list) {\n\
            this.list.toggle(name);\n\
            return this;\n\
          }\n\
        \n\
          // fallback\n\
          if (this.has(name)) {\n\
            this.remove(name);\n\
          } else {\n\
            this.add(name);\n\
          }\n\
          return this;\n\
        };\n\
        \n\
        /**\n\
         * Return an array of classes.\n\
         *\n\
         * @return {Array}\n\
         * @api public\n\
         */\n\
        \n\
        ClassList.prototype.array = function(){\n\
          var str = this.el.className.replace(/^\\s+|\\s+$/g, '');\n\
          var arr = str.split(re);\n\
          if ('' === arr[0]) arr.shift();\n\
          return arr;\n\
        };\n\
        \n\
        /**\n\
         * Check if class `name` is present.\n\
         *\n\
         * @param {String} name\n\
         * @return {ClassList}\n\
         * @api public\n\
         */\n\
        \n\
        ClassList.prototype.has =\n\
        ClassList.prototype.contains = function(name){\n\
          return this.list\n\
            ? this.list.contains(name)\n\
            : !! ~index(this.array(), name);\n\
        };\n\
        //@ sourceURL=component-classes/index.js"
    ));
    fakeRequire.register("darsain-tooltip/index.js", Function("exports, fakeRequire, module",
        "'use strict';\n\
        \n\
        /**\n\
         * Dependencies.\n\
         */\n\
        var evt = fakeRequire('event');\n\
        var classes = fakeRequire('classes');\n\
        var indexOf = fakeRequire('indexof');\n\
        var position = fakeRequire('position');\n\
        \n\
        /**\n\
         * Globals.\n\
         */\n\
        var win = window;\n\
        var doc = win.document;\n\
        var body = doc.body;\n\
        var verticalPlaces = ['top', 'bottom'];\n\
        \n\
        /**\n\
         * Transport.\n\
         */\n\
        module.exports = Tooltip;\n\
        \n\
        /**\n\
         * Prototypal inheritance.\n\
         *\n\
         * @param {Object} o\n\
         *\n\
         * @return {Object}\n\
         */\n\
        var objectCreate = Object.create || (function () {\n\
        \tfunction F() {}\n\
        \treturn function (o) {\n\
        \t\tF.prototype = o;\n\
        \t\treturn new F();\n\
        \t};\n\
        })();\n\
        \n\
        /**\n\
         * Poor man's shallow object extend.\n\
         *\n\
         * @param {Object} a\n\
         * @param {Object} b\n\
         *\n\
         * @return {Object}\n\
         */\n\
        function extend(a, b) {\n\
        \tfor (var key in b) {\n\
        \t\ta[key] = b[key];\n\
        \t}\n\
        \treturn a;\n\
        }\n\
        \n\
        /**\n\
         * Parse integer from strings like '-50px'.\n\
         *\n\
         * @param {Mixed} value\n\
         *\n\
         * @return {Integer}\n\
         */\n\
        function parsePx(value) {\n\
        \treturn 0 | Math.round(String(value).replace(/[^\\-0-9.]/g, ''));\n\
        }\n\
        \n\
        /**\n\
         * Get computed style of element.\n\
         *\n\
         * @param {Element} element\n\
         *\n\
         * @type {String}\n\
         */\n\
        var style = win.getComputedStyle ? function style(element, name) {\n\
        \treturn win.getComputedStyle(element, null)[name];\n\
        } : function style(element, name) {\n\
        \treturn element.currentStyle[name];\n\
        };\n\
        \n\
        /**\n\
         * Returns transition duration of element in ms.\n\
         *\n\
         * @param {Element} element\n\
         *\n\
         * @return {Int}\n\
         */\n\
        function transitionDuration(element) {\n\
        \tvar duration = String(style(element, transitionDuration.propName));\n\
        \tvar match = duration.match(/([0-9.]+)([ms]{1,2})/);\n\
        \tif (match) {\n\
        \t\tduration = Number(match[1]);\n\
        \t\tif (match[2] === 's') {\n\
        \t\t\tduration *= 1000;\n\
        \t\t}\n\
        \t}\n\
        \treturn 0|duration;\n\
        }\n\
        transitionDuration.propName = (function () {\n\
        \tvar element = doc.createElement('div');\n\
        \tvar names = ['transitionDuration', 'webkitTransitionDuration'];\n\
        \tvar value = '1s';\n\
        \tfor (var i = 0; i < names.length; i++) {\n\
        \t\telement.style[names[i]] = value;\n\
        \t\tif (element.style[names[i]] === value) {\n\
        \t\t\treturn names[i];\n\
        \t\t}\n\
        \t}\n\
        }());\n\
        \n\
        /**\n\
         * Tooltip construnctor.\n\
         *\n\
         * @param {String|Element} content\n\
         * @param {Object}         options\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        function Tooltip(content, options) {\n\
        \tif (!(this instanceof Tooltip)) {\n\
        \t\treturn new Tooltip(content, options);\n\
        \t}\n\
        \tthis.hidden = 1;\n\
        \tthis.options = extend(objectCreate(Tooltip.defaults), options);\n\
        \tthis._createElement();\n\
        \tthis.content(content);\n\
        }\n\
        \n\
        /**\n\
         * Creates a tooltip element.\n\
         *\n\
         * @return {Void}\n\
         */\n\
        Tooltip.prototype._createElement = function () {\n\
        \tthis.element = doc.createElement('div');\n\
        \tthis.classes = classes(this.element);\n\
        \tthis.classes.add(this.options.baseClass);\n\
        \tvar propName;\n\
        \tfor (var i = 0; i < Tooltip.classTypes.length; i++) {\n\
        \t\tpropName = Tooltip.classTypes[i] + 'Class';\n\
        \t\tif (this.options[propName]) {\n\
        \t\t\tthis.classes.add(this.options[propName]);\n\
        \t\t}\n\
        \t}\n\
        };\n\
        \n\
        /**\n\
         * Changes tooltip's type class type.\n\
         *\n\
         * @param {String} name\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.type = function (name) {\n\
        \treturn this.changeClassType('type', name);\n\
        };\n\
        \n\
        /**\n\
         * Changes tooltip's effect class type.\n\
         *\n\
         * @param {String} name\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.effect = function (name) {\n\
        \treturn this.changeClassType('effect', name);\n\
        };\n\
        \n\
        /**\n\
         * Changes class type.\n\
         *\n\
         * @param {String} propName\n\
         * @param {String} newClass\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.changeClassType = function (propName, newClass) {\n\
        \tpropName += 'Class';\n\
        \tif (this.options[propName]) {\n\
        \t\tthis.classes.remove(this.options[propName]);\n\
        \t}\n\
        \tthis.options[propName] = newClass;\n\
        \tif (newClass) {\n\
        \t\tthis.classes.add(newClass);\n\
        \t}\n\
        \treturn this;\n\
        };\n\
        \n\
        /**\n\
         * Updates tooltip's dimensions.\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.updateSize = function () {\n\
        \tif (this.hidden) {\n\
        \t\tthis.element.style.visibility = 'hidden';\n\
        \t\tbody.appendChild(this.element);\n\
        \t}\n\
        \tthis.width = this.element.offsetWidth;\n\
        \tthis.height = this.element.offsetHeight;\n\
        \tif (this.spacing == null) {\n\
        \t\tthis.spacing = this.options.spacing != null ? this.options.spacing : parsePx(style(this.element, 'top'));\n\
        \t}\n\
        \tif (this.offset == null) {\n\
        \t\tthis.offset = this.options.offset != null ? this.options.offset : 0;\n\
    \t}\n\
        \tif (this.hidden) {\n\
        \t\tbody.removeChild(this.element);\n\
        \t\tthis.element.style.visibility = '';\n\
        \t} else {\n\
        \t\tthis.position();\n\
        \t}\n\
        \treturn this;\n\
        };\n\
        \n\
        /**\n\
         * Change tooltip content.\n\
         *\n\
         * When tooltip is visible, its size is automatically\n\
         * synced and tooltip correctly repositioned.\n\
         *\n\
         * @param {String|Element} content\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.content = function (content) {\n\
        \tif (typeof content === 'object') {\n\
        \t\tthis.element.innerHTML = '';\n\
        \t\tthis.element.appendChild(content);\n\
        \t} else {\n\
        \t\tthis.element.innerHTML = content;\n\
        \t}\n\
        \tthis.updateSize();\n\
        \treturn this;\n\
        };\n\
        \n\
        /**\n\
         * Pick new place tooltip should be displayed at.\n\
         *\n\
         * When the tooltip is visible, it is automatically positioned there.\n\
         *\n\
         * @param {String} place\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.place = function (place) {\n\
        \tthis.options.place = place;\n\
        \tif (!this.hidden) {\n\
        \t\tthis.position();\n\
        \t}\n\
        \treturn this;\n\
        };\n\
        \n\
        /**\n\
         * Attach tooltip to an element.\n\
         *\n\
         * @param {Element} element\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.attach = function (element) {\n\
        \tthis.attachedTo = element;\n\
        \tif (!this.hidden) {\n\
        \t\tthis.position();\n\
        \t}\n\
        \treturn this;\n\
        };\n\
        \n\
        /**\n\
         * Detach tooltip from element.\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.detach = function () {\n\
        \tthis.hide();\n\
        \tthis.attachedTo = null;\n\
        \treturn this;\n\
        };\n\
        \n\
        /**\n\
         * Pick the most reasonable place for target position.\n\
         *\n\
         * @param {Object} target\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype._pickPlace = function (target) {\n\
        \tif (!this.options.auto) {\n\
        \t\treturn this.options.place;\n\
        \t}\n\
        \tvar winPos = position(win);\n\
        \tvar place = this.options.place.split('-');\n\
        \tvar spacing = this.spacing;\n\
        \n\
        \tif (~indexOf(verticalPlaces, place[0])) {\n\
        \t\tif (target.top - this.height - spacing <= winPos.top) {\n\
        \t\t\tplace[0] = 'bottom';\n\
        \t\t} else if (target.bottom + this.height + spacing >= winPos.bottom) {\n\
        \t\t\tplace[0] = 'top';\n\
        \t\t}\n\
        \t\tswitch (place[1]) {\n\
        \t\t\tcase 'left':\n\
        \t\t\t\tif (target.right - this.width <= winPos.left) {\n\
        \t\t\t\t\tplace[1] = 'right';\n\
        \t\t\t\t}\n\
        \t\t\t\tbreak;\n\
        \t\t\tcase 'right':\n\
        \t\t\t\tif (target.left + this.width >= winPos.right) {\n\
        \t\t\t\t\tplace[1] = 'left';\n\
        \t\t\t\t}\n\
        \t\t\t\tbreak;\n\
        \t\t\tdefault:\n\
        \t\t\t\tif (target.left + target.width / 2 + this.width / 2 >= winPos.right) {\n\
        \t\t\t\t\tplace[1] = 'left';\n\
        \t\t\t\t} else if (target.right - target.width / 2 - this.width / 2 <= winPos.left) {\n\
        \t\t\t\t\tplace[1] = 'right';\n\
        \t\t\t\t}\n\
        \t\t}\n\
        \t} else {\n\
        \t\tif (target.left - this.width - spacing <= winPos.left) {\n\
        \t\t\tplace[0] = 'right';\n\
        \t\t} else if (target.right + this.width + spacing >= winPos.right) {\n\
        \t\t\tplace[0] = 'left';\n\
        \t\t}\n\
        \t\tswitch (place[1]) {\n\
        \t\t\tcase 'top':\n\
        \t\t\t\tif (target.bottom - this.height <= winPos.top) {\n\
        \t\t\t\t\tplace[1] = 'bottom';\n\
        \t\t\t\t}\n\
        \t\t\t\tbreak;\n\
        \t\t\tcase 'bottom':\n\
        \t\t\t\tif (target.top + this.height >= winPos.bottom) {\n\
        \t\t\t\t\tplace[1] = 'top';\n\
        \t\t\t\t}\n\
        \t\t\t\tbreak;\n\
        \t\t\tdefault:\n\
        \t\t\t\tif (target.top + target.height / 2 + this.height / 2 >= winPos.bottom) {\n\
        \t\t\t\t\tplace[1] = 'top';\n\
        \t\t\t\t} else if (target.bottom - target.height / 2 - this.height / 2 <= winPos.top) {\n\
        \t\t\t\t\tplace[1] = 'bottom';\n\
        \t\t\t\t}\n\
        \t\t}\n\
        \t}\n\
        \n\
        \treturn place.join('-');\n\
        };\n\
        \n\
        /**\n\
         * Position the element to an element or a specific coordinates.\n\
         *\n\
         * @param {Integer|Element} x\n\
         * @param {Integer}         y\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.position = function (x, y) {\n\
        \tif (this.attachedTo) {\n\
        \t\tx = this.attachedTo;\n\
        \t}\n\
        \tif (x == null && this._p) {\n\
        \t\tx = this._p[0];\n\
        \t\ty = this._p[1];\n\
        \t} else {\n\
        \t\tthis._p = arguments;\n\
        \t}\n\
        \tvar target = typeof x === 'number' ? {\n\
        \t\tleft: 0|x,\n\
        \t\tright: 0|x,\n\
        \t\ttop: 0|y,\n\
        \t\tbottom: 0|y,\n\
        \t\twidth: 0,\n\
        \t\theight: 0\n\
        \t} : position(x);\n\
        \tvar spacing = Number(this.spacing), offset = Number(this.offset);\n\
        \tvar newPlace = this._pickPlace(target);\n\
        \n\
        \t// Add/Change place class when necessary\n\
        \tif (newPlace !== this.curPlace) {\n\
        \t\tif (this.curPlace) {\n\
        \t\t\tthis.classes.remove(this.curPlace);\n\
        \t\t}\n\
        \t\tthis.classes.add(newPlace);\n\
        \t\tthis.curPlace = newPlace;\n\
        \t}\n\
        \n\
        \t// Position the tip\n\
        \tvar top, left;\n\
        \tswitch (this.curPlace) {\n\
        \t\tcase 'top':\n\
        \t\t\ttop = target.top - this.height - spacing;\n\
        \t\t\tleft = target.left + target.width / 2 - this.width / 2;\n\
        \t\t\tbreak;\n\
        \t\tcase 'top-left':\n\
        \t\t\ttop = target.top - this.height - spacing;\n\
        \t\t\tleft = target.right - this.width - offset;\n\
        \t\t\tbreak;\n\
        \t\tcase 'top-right':\n\
        \t\t\ttop = target.top - this.height - spacing;\n\
        \t\t\tleft = target.left + offset;\n\
        \t\t\tbreak;\n\
        \n\
        \t\tcase 'bottom':\n\
        \t\t\ttop = target.bottom + spacing;\n\
        \t\t\tleft = target.left + target.width / 2 - this.width / 2;\n\
        \t\t\tbreak;\n\
        \t\tcase 'bottom-left':\n\
        \t\t\ttop = target.bottom + spacing;\n\
        \t\t\tleft = target.right - this.width - offset;\n\
        \t\t\tbreak;\n\
        \t\tcase 'bottom-right':\n\
        \t\t\ttop = target.bottom + spacing;\n\
        \t\t\tleft = target.left + offset;\n\
        \t\t\tbreak;\n\
        \n\
        \t\tcase 'left':\n\
        \t\t\ttop = target.top + target.height / 2 - this.height / 2;\n\
        \t\t\tleft = target.left - this.width - spacing;\n\
        \t\t\tbreak;\n\
        \t\tcase 'left-top':\n\
        \t\t\ttop = target.bottom - this.height;\n\
        \t\t\tleft = target.left - this.width - spacing;\n\
        \t\t\tbreak;\n\
        \t\tcase 'left-bottom':\n\
        \t\t\ttop = target.top;\n\
        \t\t\tleft = target.left - this.width - spacing;\n\
        \t\t\tbreak;\n\
        \n\
        \t\tcase 'right':\n\
        \t\t\ttop = target.top + target.height / 2 - this.height / 2;\n\
        \t\t\tleft = target.right + spacing;\n\
        \t\t\tbreak;\n\
        \t\tcase 'right-top':\n\
        \t\t\ttop = target.bottom - this.height;\n\
        \t\t\tleft = target.right + spacing;\n\
        \t\t\tbreak;\n\
        \t\tcase 'right-bottom':\n\
        \t\t\ttop = target.top;\n\
        \t\t\tleft = target.right + spacing;\n\
        \t\t\tbreak;\n\
        \t}\n\
        \n\
        \t// Set tip position & class\n\
        \tthis.element.style.top = Math.round(top) + 'px';\n\
        \tthis.element.style.left = Math.round(left) + 'px';\n\
        \n\
        \treturn this;\n\
        };\n\
        \n\
        /**\n\
         * Show the tooltip.\n\
         *\n\
         * @param {Integer|Element} x\n\
         * @param {Integer}         y\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.show = function (x, y) {\n\
        \tx = this.attachedTo ? this.attachedTo : x;\n\
        \n\
        \t// Clear potential ongoing animation\n\
        \tclearTimeout(this.aIndex);\n\
        \n\
        \t// Position the element when requested\n\
        \tif (x != null) {\n\
        \t\tthis.position(x, y);\n\
        \t}\n\
        \n\
        \t// Stop here if tip is already visible\n\
        \tif (this.hidden) {\n\
        \t\tthis.hidden = 0;\n\
        \t\tbody.appendChild(this.element);\n\
        \t}\n\
        \n\
        \t// Make tooltip aware of window resize\n\
        \tif (this.attachedTo) {\n\
        \t\tthis._aware();\n\
        \t}\n\
        \n\
        \t// Trigger layout and kick in the transition\n\
        \tif (this.options.inClass) {\n\
        \t\tif (this.options.effectClass) {\n\
        \t\t\tvoid this.element.clientHeight;\n\
        \t\t}\n\
        \t\tthis.classes.add(this.options.inClass);\n\
        \t}\n\
        \n\
        \treturn this;\n\
        };\n\
        \n\
        /**\n\
         * Hide the tooltip.\n\
         *\n\
         * @return {Tooltip}\n\
         */\n\
        Tooltip.prototype.hide = function () {\n\
        \tif (this.hidden) {\n\
        \t\treturn;\n\
        \t}\n\
        \n\
        \tvar self = this;\n\
        \tvar duration = 0;\n\
        \n\
        \t// Remove .in class and calculate transition duration if any\n\
        \tif (this.options.inClass) {\n\
        \t\tthis.classes.remove(this.options.inClass);\n\
        \t\tif (this.options.effectClass) {\n\
        \t\t\tduration = transitionDuration(this.element);\n\
        \t\t}\n\
        \t}\n\
        \n\
        \t// Remove tip from window resize awareness\n\
        \tif (this.attachedTo) {\n\
        \t\tthis._unaware();\n\
        \t}\n\
        \n\
        \t// Remove the tip from the DOM when transition is done\n\
        \tclearTimeout(this.aIndex);\n\
        \tthis.aIndex = setTimeout(function () {\n\
        \t\tself.aIndex = 0;\n\
        \t\tbody.removeChild(self.element);\n\
        \t\tself.hidden = 1;\n\
        \t}, duration);\n\
        \n\
        \treturn this;\n\
        };\n\
        \n\
        Tooltip.prototype.toggle = function (x, y) {\n\
        \treturn this[this.hidden ? 'show' : 'hide'](x, y);\n\
        };\n\
        \n\
        Tooltip.prototype.destroy = function () {\n\
        \tclearTimeout(this.aIndex);\n\
        \tthis._unaware();\n\
        \tif (!this.hidden) {\n\
        \t\tbody.removeChild(this.element);\n\
        \t}\n\
        \tthis.element = this.options = null;\n\
        };\n\
        \n\
        /**\n\
         * Make the tip window resize aware.\n\
         *\n\
         * @return {Void}\n\
         */\n\
        Tooltip.prototype._aware = function () {\n\
        \tvar index = indexOf(Tooltip.winAware, this);\n\
        \tif (!~index) {\n\
        \t\tTooltip.winAware.push(this);\n\
        \t}\n\
        };\n\
        \n\
        /**\n\
         * Remove the window resize awareness.\n\
         *\n\
         * @return {Void}\n\
         */\n\
        Tooltip.prototype._unaware = function () {\n\
        \tvar index = indexOf(Tooltip.winAware, this);\n\
        \tif (~index) {\n\
        \t\tTooltip.winAware.splice(index, 1);\n\
        \t}\n\
        };\n\
        \n\
        /**\n\
         * Handles repositioning of tooltips on window resize.\n\
         *\n\
         * @return {Void}\n\
         */\n\
        Tooltip.reposition = (function () {\n\
        \tvar rAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || function (fn) {\n\
        \t\treturn setTimeout(fn, 17);\n\
        \t};\n\
        \tvar rIndex;\n\
        \n\
        \tfunction requestReposition() {\n\
        \t\tif (rIndex || !Tooltip.winAware.length) {\n\
        \t\t\treturn;\n\
        \t\t}\n\
        \t\trIndex = rAF(reposition, 17);\n\
        \t}\n\
        \n\
        \tfunction reposition() {\n\
        \t\trIndex = 0;\n\
        \t\tvar tip;\n\
        \t\tfor (var i = 0, l = Tooltip.winAware.length; i < l; i++) {\n\
        \t\t\ttip = Tooltip.winAware[i];\n\
        \t\t\ttip.position();\n\
        \t\t}\n\
        \t}\n\
        \n\
        \treturn requestReposition;\n\
        }());\n\
        Tooltip.winAware = [];\n\
        \n\
        // Bind winAware repositioning to window resize event\n\
        evt.bind(window, 'resize', Tooltip.reposition);\n\
        evt.bind(window, 'scroll', Tooltip.reposition);\n\
        \n\
        /**\n\
         * Array with dynamic class types.\n\
         *\n\
         * @type {Array}\n\
         */\n\
        Tooltip.classTypes = ['type', 'effect'];\n\
        \n\
        /**\n\
         * Default options for Tooltip constructor.\n\
         *\n\
         * @type {Object}\n\
         */\n\
        Tooltip.defaults = {\n\
        \tbaseClass:   'tooltip', // Base tooltip class name.\n\
        \ttypeClass:   null,      // Type tooltip class name.\n\
        \teffectClass: null,      // Effect tooltip class name.\n\
        \tinClass:     'in',      // Class used to transition stuff in.\n\
        \tplace:       'top',     // Default place.\n\
        \tspacing:     null,      // Gap between target and tooltip.\n\
        \toffset:      null,      // Horizontal offset to align arrow\n\
        \tauto:        0          // Whether to automatically adjust place to fit into window.\n\
        };//@ sourceURL=darsain-tooltip/index.js"
    ));
    fakeRequire.register("darsain-event/index.js", Function("exports, fakeRequire, module",
        "'use strict';\n\
        \n\
        /**\n\
         * Bind `el` event `type` to `fn`.\n\
         *\n\
         * @param {Element}  el\n\
         * @param {String}   type\n\
         * @param {Function} fn\n\
         * @param {Boolean}  capture\n\
         *\n\
         * @return {Function}\n\
         */\n\
        exports.bind = window.addEventListener ? function (el, type, fn, capture) {\n\
        \tel.addEventListener(type, fn, capture || false);\n\
        \treturn fn;\n\
        } : function (el, type, fn) {\n\
        \tvar fnid = type + fn;\n\
        \tel[fnid] = el[fnid] || function () {\n\
        \t\tvar event = window.event;\n\
        \t\tevent.target = event.srcElement;\n\
        \t\tevent.preventDefault = function () {\n\
        \t\t\tevent.returnValue = false;\n\
        \t\t};\n\
        \t\tevent.stopPropagation = function () {\n\
        \t\t\tevent.cancelBubble = true;\n\
        \t\t};\n\
        \t\tfn.call(el, event);\n\
        \t};\n\
        \tel.attachEvent('on' + type, el[fnid]);\n\
        \treturn fn;\n\
        };\n\
        \n\
        /**\n\
         * Unbind `el` event `type`'s callback `fn`.\n\
         *\n\
         * @param {Element}  el\n\
         * @param {String}   type\n\
         * @param {Function} fn\n\
         * @param {Boolean}  capture\n\
         *\n\
         * @return {Function}\n\
         */\n\
        exports.unbind = window.removeEventListener ? function (el, type, fn, capture) {\n\
        \tel.removeEventListener(type, fn, capture || false);\n\
        \treturn fn;\n\
        } : function (el, type, fn) {\n\
        \tvar fnid = type + fn;\n\
        \tel.detachEvent('on' + type, el[fnid]);\n\
        \ttry {\n\
        \t\tdelete el[fnid];\n\
        \t} catch (err) {\n\
        \t\t// can't delete window object properties\n\
        \t\tel[fnid] = undefined;\n\
        \t}\n\
        \treturn fn;\n\
        };//@ sourceURL=darsain-event/index.js"
    ));
    fakeRequire.register("component-indexof/index.js", Function("exports, fakeRequire, module",
        "module.exports = function(arr, obj){\n\
          if (arr.indexOf) return arr.indexOf(obj);\n\
          for (var i = 0; i < arr.length; ++i) {\n\
            if (arr[i] === obj) return i;\n\
          }\n\
          return -1;\n\
        };//@ sourceURL=component-indexof/index.js"
    ));
    fakeRequire.register("code42day-dataset/index.js", Function("exports, fakeRequire, module",
        "module.exports=dataset;\n\
        \n\
        /*global document*/\n\
        \n\
        \n\
        // replace namesLikeThis with names-like-this\n\
        function toDashed(name) {\n\
          return name.replace(/([A-Z])/g, function(u) {\n\
            return \"-\" + u.toLowerCase();\n\
          });\n\
        }\n\
        \n\
        var fn;\n\
        \n\
        if (document.head.dataset) {\n\
          fn = {\n\
            set: function(node, attr, value) {\n\
               if (!node.dataset) return;\
               node.dataset[attr] = value;\n\
            },\n\
            get: function(node, attr) {\n\
              return node.dataset && node.dataset[attr];\n\
            }\n\
          };\n\
        } else {\n\
          fn = {\n\
            set: function(node, attr, value) {\n\
              node.setAttribute('data-' + toDashed(attr), value);\n\
            },\n\
            get: function(node, attr) {\n\
              return node.getAttribute('data-' + toDashed(attr));\n\
            }\n\
          };\n\
        }\n\
        \n\
        function dataset(node, attr, value) {\n\
          var self = {\n\
            set: set,\n\
            get: get\n\
          };\n\
        \n\
          function set(attr, value) {\n\
            fn.set(node, attr, value);\n\
            return self;\n\
          }\n\
        \n\
          function get(attr) {\n\
            return fn.get(node, attr);\n\
          }\n\
        \n\
          if (arguments.length === 3) {\n\
            return set(attr, value);\n\
          }\n\
          if (arguments.length == 2) {\n\
            return get(attr);\n\
          }\n\
        \n\
          return self;\n\
        }//@ sourceURL=code42day-dataset/index.js"
    ));
    fakeRequire.register("tooltips/index.js", Function("exports, fakeRequire, module",
        "'use strict';\n\
        \n\
        /**\n\
         * Dependencies.\n\
         */\n\
        var evt = fakeRequire('event');\n\
        var indexOf = fakeRequire('indexof');\n\
        var Tooltip = fakeRequire('tooltip');\n\
        var dataset = fakeRequire('dataset');\n\
        \n\
        /**\n\
         * Transport.\n\
         */\n\
        module.exports = Tooltips;\n\
        \n\
        /**\n\
         * Globals.\n\
         */\n\
        var MObserver = window.MutationObserver || window.WebkitMutationObserver;\n\
        \n\
        /**\n\
         * Prototypal inheritance.\n\
         *\n\
         * @param {Object} o\n\
         *\n\
         * @return {Object}\n\
         */\n\
        var objectCreate = Object.create || (function () {\n\
        \tfunction F() {}\n\
        \treturn function (o) {\n\
        \t\tF.prototype = o;\n\
        \t\treturn new F();\n\
        \t};\n\
        })();\n\
        \n\
        /**\n\
         * Poor man's shallow object extend.\n\
         *\n\
         * @param {Object} a\n\
         * @param {Object} b\n\
         *\n\
         * @return {Object}\n\
         */\n\
        function extend(a, b) {\n\
        \tfor (var key in b) {\n\
        \t\ta[key] = b[key];\n\
        \t}\n\
        \treturn a;\n\
        }\n\
        \n\
        /**\n\
         * Capitalize the first letter of a string.\n\
         *\n\
         * @param {String} string\n\
         *\n\
         * @return {String}\n\
         */\n\
        function ucFirst(string) {\n\
        \treturn string.charAt(0).toUpperCase() + string.slice(1);\n\
        }\n\
        \n\
        /**\n\
         * Tooltips constructor.\n\
         *\n\
         * @param {Element} container\n\
         * @param {Object}  options\n\
         *\n\
         * @return {Tooltips}\n\
         */\n\
        function Tooltips(container, options) {\n\
        \tif (!(this instanceof Tooltips)) {\n\
        \t\treturn new Tooltips(container, options);\n\
        \t}\n\
        \n\
        \tvar self = this;\n\
        \tvar observer, TID;\n\
        \n\
        \t/**\n\
        \t * Show tooltip attached to an element.\n\
        \t *\n\
        \t * @param {Element} element\n\
        \t *\n\
        \t * @return {Tooltips}\n\
        \t */\n\
        \tself.show = function (element) {\n\
        \t\treturn callTooltipMethod(element, 'show');\n\
        \t};\n\
        \n\
        \t/**\n\
        \t * Hide tooltip attached to an element.\n\
        \t *\n\
        \t * @param {Element} element\n\
        \t *\n\
        \t * @return {Tooltips}\n\
        \t */\n\
        \tself.hide = function (element) {\n\
        \t\treturn callTooltipMethod(element, 'hide');\n\
        \t};\n\
        \n\
        \t/**\n\
        \t * Toggle tooltip attached to an element.\n\
        \t *\n\
        \t * @param {Element} element\n\
        \t *\n\
        \t * @return {Tooltips}\n\
        \t */\n\
        \tself.toggle = function (element) {\n\
        \t\treturn callTooltipMethod(element, 'toggle');\n\
        \t};\n\
        \n\
        \t/**\n\
        \t * Retrieve tooltip attached to an element and call it's method.\n\
        \t *\n\
        \t * @param {Element} element\n\
        \t * @param {String}  method\n\
        \t *\n\
        \t * @return {Tooltips}\n\
        \t */\n\
        \tfunction callTooltipMethod(element, method) {\n\
        \t\tvar tip = self.get(element);\n\
        \t\tif (tip) {\n\
        \t\t\ttip[method]();\n\
        \t\t}\n\
        \t\treturn self;\n\
        \t}\n\
        \n\
        \t/**\n\
        \t * Return a tooltip attached to an element. Tooltip is created if it doesn't exist yet.\n\
        \t *\n\
        \t * @param {Element} element\n\
        \t *\n\
        \t * @return {Tooltip}\n\
        \t */\n\
        \tself.get = function (element) {\n\
        \t\tvar tip = !!element && (element[TID] || createTip(element));\n\
        \t\tif (tip && !element[TID]) {\n\
        \t\t\telement[TID] = tip;\n\
        \t\t}\n\
        \t\treturn tip;\n\
        \t};\n\
        \n\
        \t/**\n\
        \t * Add element(s) to Tooltips instance.\n\
        \t *\n\
        \t * @param {[type]} element Can be element, or container containing elements to be added.\n\
        \t *\n\
        \t * @return {Tooltips}\n\
        \t */\n\
        \tself.add = function (element) {\n\
        \t\tif (!element || element.nodeType !== 1) {\n\
        \t\t\treturn self;\n\
        \t\t}\n\
        \t\tif (dataset(element).get(options.key)) {\n\
        \t\t\tbindElement(element);\n\
        \t\t} else if (element.children) {\n\
        \t\t\tbindElements(element.querySelectorAll(self.selector));\n\
        \t\t}\n\
        \t\treturn self;\n\
        \t};\n\
        \n\
        \t/**\n\
        \t * Remove element(s) from Tooltips instance.\n\
        \t *\n\
        \t * @param {Element} element Can be element, or container containing elements to be removed.\n\
        \t *\n\
        \t * @return {Tooltips}\n\
        \t */\n\
        \tself.remove = function (element) {\n\
        \t\tif (!element || element.nodeType !== 1) {\n\
        \t\t\treturn self;\n\
        \t\t}\n\
        \t\tif (dataset(element).get(options.key)) {\n\
        \t\t\tunbindElement(element);\n\
        \t\t} else if (element.children) {\n\
        \t\t\tunbindElements(element.querySelectorAll(self.selector));\n\
        \t\t}\n\
        \t\treturn self;\n\
        \t};\n\
        \n\
        \t/**\n\
        \t * Reload Tooltips instance.\n\
        \t *\n\
        \t * Unbinds current tooltipped elements, than selects the\n\
        \t * data-key elements from container and binds them again.\n\
        \t *\n\
        \t * @return {Tooltips}\n\
        \t */\n\
        \tself.reload = function () {\n\
        \t\t// Unbind old elements\n\
        \t\tunbindElements(self.elements);\n\
        \t\t// Bind new elements\n\
        \t\tbindElements(self.container.querySelectorAll(self.selector));\n\
        \t\treturn self;\n\
        \t};\n\
        \n\
        \t/**\n\
        \t * Destroy Tooltips instance.\n\
        \t *\n\
        \t * @return {Void}\n\
        \t */\n\
        \tself.destroy = function () {\n\
        \t\tunbindElements(this.elements);\n\
        \t\tif (observer) {\n\
        \t\t\tobserver.disconnect();\n\
        \t\t}\n\
        \t\tthis.container = this.elements = this.options = observer = null;\n\
        \t};\n\
        \n\
        \t/**\n\
        \t * Create a tip from element data attributes.\n\
        \t *\n\
        \t * @param {Element} element\n\
        \t *\n\
        \t * @return {Tooltip}\n\
        \t */\n\
        \tfunction createTip(element) {\n\
        \t\tvar data = dataset(element);\n\
        \t\tvar content = data.get(options.key);\n\
        \t\tif (!content) {\n\
        \t\t\treturn false;\n\
        \t\t}\n\
        \t\tvar tipOptions = objectCreate(options.tooltip);\n\
        \t\tvar keyData;\n\
        \t\tfor (var key in Tooltip.defaults) {\n\
        \t\t\tkeyData = data.get(options.key + ucFirst(key.replace(/Class$/, '')));\n\
        \t\t\tif (!keyData) {\n\
        \t\t\t\tcontinue;\n\
        \t\t\t}\n\
        \t\t\ttipOptions[key] = keyData;\n\
        \t\t}\n\
        \t\treturn new Tooltip(content, tipOptions).attach(element);\n\
        \t}\n\
        \n\
        \t/**\n\
        \t * Bind Tooltips events to Array/NodeList of elements.\n\
        \t *\n\
        \t * @param {Array} elements\n\
        \t *\n\
        \t * @return {Void}\n\
        \t */\n\
        \tfunction bindElements(elements) {\n\
        \t\tfor (var i = 0, l = elements.length; i < l; i++) {\n\
        \t\t\tbindElement(elements[i]);\n\
        \t\t}\n\
        \t}\n\
        \n\
        \t/**\n\
        \t * Bind Tooltips events to element.\n\
        \t *\n\
        \t * @param {Element} element\n\
        \t *\n\
        \t * @return {Void}\n\
        \t */\n\
        \tfunction bindElement(element) {\n\
        \t\tif (element[TID] || ~indexOf(self.elements, element)) {\n\
        \t\t\treturn;\n\
        \t\t}\n\
        \t\tevt.bind(element, options.showOn, eventHandler);\n\
        \t\tevt.bind(element, options.hideOn, eventHandler);\n\
        \t\tself.elements.push(element);\n\
        \t}\n\
        \n\
        \t/**\n\
        \t * Unbind Tooltips events from Array/NodeList of elements.\n\
        \t *\n\
        \t * @param {Array} elements\n\
        \t *\n\
        \t * @return {Void}\n\
        \t */\n\
        \tfunction unbindElements(elements) {\n\
        \t\tif (self.elements === elements) {\n\
        \t\t\telements = elements.slice();\n\
        \t\t}\n\
        \t\tfor (var i = 0, l = elements.length; i < l; i++) {\n\
        \t\t\tunbindElement(elements[i]);\n\
        \t\t}\n\
        \t}\n\
        \n\
        \t/**\n\
        \t * Unbind Tooltips events from element.\n\
        \t *\n\
        \t * @param {Element} element\n\
        \t *\n\
        \t * @return {Void}\n\
        \t */\n\
        \tfunction unbindElement(element) {\n\
        \t\tvar index = indexOf(self.elements, element);\n\
        \t\tif (!~index) {\n\
        \t\t\treturn;\n\
        \t\t}\n\
        \t\tif (element[TID]) {\n\
        \t\t\telement[TID].destroy();\n\
        \t\t\tdelete element[TID];\n\
        \t\t}\n\
        \t\tevt.unbind(element, options.showOn, eventHandler);\n\
        \t\tevt.unbind(element, options.hideOn, eventHandler);\n\
        \t\tself.elements.splice(index, 1);\n\
        \t}\n\
        \n\
        \t/**\n\
        \t * Tooltips events handler.\n\
        \t *\n\
        \t * @param {Event} event\n\
        \t *\n\
        \t * @return {Void}\n\
        \t */\n\
        \tfunction eventHandler(event) {\n\
        \t\t/*jshint validthis:true */\n\
        \t\tif (options.showOn === options.hideOn) {\n\
        \t\t\tself.toggle(this);\n\
        \t\t} else {\n\
        \t\t\tself[event.type === options.showOn ? 'show' : 'hide'](this);\n\
        \t\t}\n\
        \t}\n\
        \n\
        \t/**\n\
        \t * Mutations handler.\n\
        \t *\n\
        \t * @param {Array} mutations\n\
        \t *\n\
        \t * @return {Void}\n\
        \t */\n\
        \tfunction mutationsHandler(mutations) {\n\
        \t\tvar added, removed, i, l;\n\
        \t\tfor (var m = 0, ml = mutations.length; m < ml; m++) {\n\
        \t\t\tadded = mutations[m].addedNodes;\n\
        \t\t\tremoved = mutations[m].removedNodes;\n\
        \t\t\tfor (i = 0, l = added.length; i < l; i++) {\n\
        \t\t\t\tself.add(added[i]);\n\
        \t\t\t}\n\
        \t\t\tfor (i = 0, l = removed.length; i < l; i++) {\n\
        \t\t\t\tself.remove(removed[i]);\n\
        \t\t\t}\n\
        \t\t\tif (mutations[m].type == 'attributes' && mutations[m].attributeName == 'data-title'){\n\
        \t\t\t\tif (!self.get(mutations[m])) { self.add(mutations[m].target); }\n\
        \t\t\t\tself.get(mutations[m].target).content(dataset(mutations[m].target).get('title'));\n\
        \t\t\t}\n\
        \t\t}\n\
        \t}\n\
        \n\
        \t// Construct\n\
        \t(function () {\n\
        \t\tself.container = container;\n\
        \t\tself.options = options = extend(objectCreate(Tooltips.defaults), options);\n\
        \t\tself.ID = TID = options.key + Math.random().toString(36).slice(2);\n\
        \t\tself.elements = [];\n\
        \n\
        \t\t// Create tips selector\n\
        \t\tself.selector = '[data-' + options.key + ']';\n\
        \n\
        \t\t// Load tips\n\
        \t\tself.reload();\n\
        \n\
        \t\t// Create mutations observer\n\
        \t\tif (options.observe && MObserver) {\n\
        \t\t\tobserver = new MObserver(mutationsHandler);\n\
        \t\t\tobserver.observe(self.container, {\n\
        \t\t\t\tchildList: true,\n\
        \t\t\t\tsubtree: true,\n\
        \t\t\t\tattributes: true\n\
        \t\t\t});\n\
        \t\t}\n\
        \t}());\n\
        }\n\
        \n\
        /**\n\
         * Expose Tooltip.\n\
         */\n\
        Tooltips.Tooltip = Tooltip;\n\
        \n\
        /**\n\
         * Default Tooltips options.\n\
         *\n\
         * @type {Object}\n\
         */\n\
        Tooltips.defaults = {\n\
        \ttooltip:    {},          // Options for individual Tooltip instances.\n\
        \tkey:       'tooltip',    // Tooltips data attribute key.\n\
        \tshowOn:    'mouseenter', // Show tooltip event.\n\
        \thideOn:    'mouseleave', // Hide tooltip event.\n\
        \tobserve:   0             // Enable mutation observer (used only when supported).\n\
        };//@ sourceURL=tooltips/index.js"
    ));










    fakeRequire.alias("darsain-tooltip/index.js", "tooltips/deps/tooltip/index.js");
    fakeRequire.alias("darsain-tooltip/index.js", "tooltip/index.js");
    fakeRequire.alias("darsain-event/index.js", "darsain-tooltip/deps/event/index.js");

    fakeRequire.alias("darsain-position/index.js", "darsain-tooltip/deps/position/index.js");

    fakeRequire.alias("component-classes/index.js", "darsain-tooltip/deps/classes/index.js");
    fakeRequire.alias("component-indexof/index.js", "component-classes/deps/indexof/index.js");

    fakeRequire.alias("component-indexof/index.js", "darsain-tooltip/deps/indexof/index.js");

    fakeRequire.alias("darsain-event/index.js", "tooltips/deps/event/index.js");
    fakeRequire.alias("darsain-event/index.js", "event/index.js");

    fakeRequire.alias("component-indexof/index.js", "tooltips/deps/indexof/index.js");
    fakeRequire.alias("component-indexof/index.js", "indexof/index.js");

    fakeRequire.alias("code42day-dataset/index.js", "tooltips/deps/dataset/index.js");
    fakeRequire.alias("code42day-dataset/index.js", "dataset/index.js");
    if (typeof exports == "object") {
        module.exports = fakeRequire("tooltips");
    } else if (typeof define == "function" && define.amd) {
        define(function(){ return fakeRequire("tooltips"); });
    } else {
        this["Tooltips"] = fakeRequire("tooltips");
    }})();

},{}]},{},[28])


//# sourceMappingURL=main.js.map
