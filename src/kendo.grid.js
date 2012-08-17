(function($, undefined) {
    var kendo = window.kendo,
        ui = kendo.ui,
        DataSource = kendo.data.DataSource,
        Groupable = ui.Groupable,
        tbodySupportsInnerHtml = kendo.support.tbodyInnerHtml,
        Widget = ui.Widget,
        keys = kendo.keys,
        isPlainObject = $.isPlainObject,
        extend = $.extend,
        map = $.map,
        grep = $.grep,
        isArray = $.isArray,
        inArray = $.inArray,
        proxy = $.proxy,
        isFunction = $.isFunction,
        isEmptyObject = $.isEmptyObject,
        math = Math,
        REQUESTSTART = "requestStart",
        ERROR = "error",
        ROW_SELECTOR = "tbody>tr:not(.k-grouping-row):not(.k-detail-row):not(.k-group-footer):visible",
        DATA_CELL = ":not(.k-group-cell):not(.k-hierarchy-cell):visible",
        SELECTION_CELL_SELECTOR = "tbody>tr:not(.k-grouping-row):not(.k-detail-row):not(.k-group-footer) > td:not(.k-group-cell):not(.k-hierarchy-cell)",
        CELL_SELECTOR =  ROW_SELECTOR + ">td" + DATA_CELL,
        FIRST_CELL_SELECTOR = ROW_SELECTOR + ":first" + ">td" + DATA_CELL + ":first",
        NS = ".kendoGrid",
        EDIT = "edit",
        SAVE = "save",
        REMOVE = "remove",
        DETAILINIT = "detailInit",
        CHANGE = "change",
        COLUMNHIDE = "columnHide",
        COLUMNSHOW = "columnShow",
        SAVECHANGES = "saveChanges",
        DATABOUND = "dataBound",
        DETAILEXPAND = "detailExpand",
        DETAILCOLLAPSE = "detailCollapse",
        FOCUSED = "k-state-focused",
        FOCUSABLE = "k-focusable",
        SELECTED = "k-state-selected",
        COLUMNRESIZE = "columnResize",
        COLUMNREORDER = "columnReorder",
        CLICK = "click",
        HEIGHT = "height",
        TABINDEX = "tabIndex",
        FUNCTION = "function",
        STRING = "string",
        DELETECONFIRM = "Are you sure you want to delete this record?",
        formatRegExp = /(\}|\#)/ig,
        indicatorWidth = 3,
        templateHashRegExp = /#/ig,
        COMMANDBUTTONTMPL = '<a class="k-button k-button-icontext #=className#" #=attr# href="\\#"><span class="#=iconClass# #=imageClass#"></span>#=text#</a>',
        isRtl = false;

    var VirtualScrollable =  Widget.extend({
        init: function(element, options) {
            var that = this;

            Widget.fn.init.call(that, element, options);
            that._refreshHandler = proxy(that.refresh, that);
            that.setDataSource(options.dataSource);
            that.wrap();
        },

        setDataSource: function(dataSource) {
            var that = this;
            if (that.dataSource) {
                that.dataSource.unbind(CHANGE, that._refreshHandler);
            }
            that.dataSource = dataSource;
            that.dataSource.bind(CHANGE, that._refreshHandler);
        },

        options: {
            name: "VirtualScrollable",
            itemHeight: $.noop
        },

        destroy: function() {
            var that = this;

            Widget.fn.destroy.call(that);

            that.dataSource.unbind(CHANGE, that._refreshHandler);
            that.wrapper.add(that.verticalScrollbar).off(NS);

            if (that.drag) {
                that.drag.destroy();
            }
        },

        wrap: function() {
            var that = this,
                // workaround for IE issue where scroll is not raised if container is same width as the scrollbar
                scrollbar = kendo.support.scrollbar() + 1,
                element = that.element;

            element.css( {
                width: "auto",
                overflow: "hidden"
            }).css((isRtl ? "padding-left" : "padding-right"), scrollbar);
            that.content = element.children().first();
            that.wrapper = that.content.wrap('<div class="k-virtual-scrollable-wrap"/>')
                                .parent()
                                .bind("DOMMouseScroll" + NS + " mousewheel" + NS, proxy(that._wheelScroll, that));

            if (kendo.support.touch) {
                that.drag = new kendo.UserEvents(that.wrapper, {
                    global: true,
                    move: function(e) {
                        that.verticalScrollbar.scrollTop(that.verticalScrollbar.scrollTop() - e.y.delta);
                        e.preventDefault();
                    }
                });
            }

            that.verticalScrollbar = $('<div class="k-scrollbar k-scrollbar-vertical" />')
                                        .css({
                                            width: scrollbar
                                        }).appendTo(element)
                                        .bind("scroll" + NS, proxy(that._scroll, that));
        },

        _wheelScroll: function(e) {
            var that = this,
                scrollTop = that.verticalScrollbar.scrollTop(),
                originalEvent = e.originalEvent,
                deltaY = originalEvent.wheelDeltaY,
                delta;


            if (originalEvent.wheelDelta) { // Webkit and IE
                if (deltaY === undefined || deltaY) { // IE does not have deltaY, thus always scroll (horizontal scrolling is treated as vertical)
                    delta = originalEvent.wheelDelta;
                }
            } else if (originalEvent.detail && originalEvent.axis === originalEvent.VERTICAL_AXIS) { // Firefox and Opera
                delta = (-originalEvent.detail) * 10;
            }

            if (delta) {
                e.preventDefault();
                that.verticalScrollbar.scrollTop(scrollTop + (-delta));
            }
        },

        _scroll: function(e) {
            var that = this,
                scrollTop = e.currentTarget.scrollTop,
                dataSource = that.dataSource,
                rowHeight = that.itemHeight,
                skip = dataSource.skip() || 0,
                start = that._rangeStart || skip,
                height = that.element.innerHeight(),
                isScrollingUp = !!(that._scrollbarTop && that._scrollbarTop > scrollTop),
                firstItemIndex = math.max(math.floor(scrollTop / rowHeight), 0),
                lastItemIndex = math.max(firstItemIndex + math.floor(height / rowHeight), 0);

            that._scrollTop = scrollTop - (start * rowHeight);
            that._scrollbarTop = scrollTop;

            if (!that._fetch(firstItemIndex, lastItemIndex, isScrollingUp)) {
                that.wrapper[0].scrollTop = that._scrollTop;
            }
        },

        _fetch: function(firstItemIndex, lastItemIndex, scrollingUp) {
            var that = this,
                dataSource = that.dataSource,
                itemHeight = that.itemHeight,
                take = dataSource.take(),
                rangeStart = that._rangeStart || dataSource.skip() || 0,
                currentSkip = math.floor(firstItemIndex / take) * take,
                fetching = false,
                prefetchAt = 0.33;

            if (firstItemIndex < rangeStart) {

                fetching = true;
                rangeStart = math.max(0, lastItemIndex - take);
                that._scrollTop = (firstItemIndex - rangeStart) * itemHeight;
                that._page(rangeStart, take);

            } else if (lastItemIndex >= rangeStart + take && !scrollingUp) {

                fetching = true;
                rangeStart = firstItemIndex;
                that._scrollTop = itemHeight;
                that._page(rangeStart, take);

            } else if (!that._fetching) {

                if (firstItemIndex < (currentSkip + take) - take * prefetchAt && firstItemIndex > take) {
                    dataSource.prefetch(currentSkip - take, take);
                }
                if (lastItemIndex > currentSkip + take * prefetchAt) {
                    dataSource.prefetch(currentSkip + take, take);
                }

            }
            return fetching;
        },

        _page: function(skip, take) {
            var that = this,
                dataSource = that.dataSource;

            clearTimeout(that._timeout);
            that._fetching = true;
            that._rangeStart = skip;

            if (dataSource.inRange(skip, take)) {
                dataSource.range(skip, take);
            } else {
                kendo.ui.progress(that.wrapper.parent(), true);
                that._timeout = setTimeout(function() {
                    dataSource.range(skip, take);
                }, 100);
            }
        },

        refresh: function() {
            var that = this,
                html = "",
                maxHeight = 250000,
                dataSource = that.dataSource,
                rangeStart = that._rangeStart,
                scrollbar = kendo.support.scrollbar(),
                wrapperElement = that.wrapper[0],
                totalHeight,
                idx,
                itemHeight;

            kendo.ui.progress(that.wrapper.parent(), false);
            clearTimeout(that._timeout);

            itemHeight = that.itemHeight = that.options.itemHeight() || 0;

            var addScrollBarHeight = (wrapperElement.scrollWidth > wrapperElement.offsetWidth) ? scrollbar : 0;

            totalHeight = dataSource.total() * itemHeight + addScrollBarHeight;

            for (idx = 0; idx < math.floor(totalHeight / maxHeight); idx++) {
                html += '<div style="width:1px;height:' + maxHeight + 'px"></div>';
            }

            if (totalHeight % maxHeight) {
                html += '<div style="width:1px;height:' + (totalHeight % maxHeight) + 'px"></div>';
            }

            that.verticalScrollbar.html(html);
            wrapperElement.scrollTop = that._scrollTop;

            if (that.drag) {
                that.drag.cancel();
            }

            if (rangeStart && !that._fetching) { // we are rebound from outside local range should be reset
                that._rangeStart = dataSource.skip();
            }
            that._fetching = false;
        }
    });

    function groupCells(count) {
        return new Array(count + 1).join('<td class="k-group-cell">&nbsp;</td>');
    }

    function stringifyAttributes(attributes) {
        var attr,
            result = " ";

        if (attributes) {
            if (typeof attributes === STRING) {
                return attributes;
            }

            for (attr in attributes) {
                result += attr + '="' + attributes[attr] + '"';
            }
        }
        return result;
    }

    var defaultCommands = {
        create: {
            text: "Add new record",
            imageClass: "k-add",
            className: "k-grid-add",
            iconClass: "k-icon"
        },
        cancel: {
            text: "Cancel changes",
            imageClass: "k-cancel",
            className: "k-grid-cancel-changes",
            iconClass: "k-icon"
        },
        save: {
            text: "Save changes",
            imageClass: "k-update",
            className: "k-grid-save-changes",
            iconClass: "k-icon"
        },
        destroy: {
            text: "Delete",
            imageClass: "k-delete",
            className: "k-grid-delete",
            iconClass: "k-icon"
        },
        edit: {
            text: "Edit",
            imageClass: "k-edit",
            className: "k-grid-edit",
            iconClass: "k-icon"
        },
        update: {
            text: "Update",
            imageClass: "k-update",
            className: "k-grid-update",
            iconClass: "k-icon"
        },
        canceledit: {
            text: "Cancel",
            imageClass: "k-cancel",
            className: "k-grid-cancel",
            iconClass: "k-icon"
        }
    };

    function heightAboveHeader(context) {
        var top = 0;
        $('> .k-grouping-header, > .k-grid-toolbar', context).each(function () {
            top += this.offsetHeight;
        });
        return top;
    }

    function cursor(context, value) {
        $('th, th .k-grid-filter, th .k-link', context)
            .add(document.body)
            .css('cursor', value);
    }

    function buildEmptyAggregatesObject(aggregates) {
            var idx,
                length,
                aggregate = {},
                fieldsMap = {};

            if (!isEmptyObject(aggregates)) {
                if (!isArray(aggregates)){
                    aggregates = [aggregates];
                }

                for (idx = 0, length = aggregates.length; idx < length; idx++) {
                    aggregate[aggregates[idx].aggregate] = 0;
                    fieldsMap[aggregates[idx].field] = aggregate;
                }
            }

            return fieldsMap;
    }

    function reorder(selector, sourceIndex, destIndex) {
        var source = selector.eq(sourceIndex),
            dest = selector.eq(destIndex);

        source[sourceIndex > destIndex ? "insertBefore" : "insertAfter"](dest);
    }

    function attachCustomCommandEvent(context, container, commands) {
        var idx,
            length,
            command,
            commandName;

        commands = !isArray(commands) ? [commands] : commands;

        for (idx = 0, length = commands.length; idx < length; idx++) {
            command = commands[idx];

            if (isPlainObject(command) && command.click) {
                commandName = command.name || command.text;
                container.on(CLICK, "a.k-grid-" + (commandName || "").replace(/\s/g, ""), { commandName: commandName }, proxy(command.click, context));
            }
        }
    }

    function visibleColumns(columns) {
        return grep(columns, function(column) {
            return !column.hidden;
        });
    }

    function addHiddenStyle(attr) {
        attr = attr || {};
        var style = attr.style;

        if(!style) {
            style = "display:none";
        } else {
            style = style.replace(/((.*)?display)(.*)?:([^;]*)/i, "$1:none");
            if(style === attr.style) {
                style = style.replace(/(.*)?/i, "display:none;$1");
            }
        }

        return extend({}, attr, { style: style });
    }

    function removeHiddenStyle(attr) {
        attr = attr || {};
        var style = attr.style;

        if(style) {
            attr.style = style.replace(/((.*)?)(display\s*:\s*none)\s*;?/i, "$1");
        }

        return attr;
    }

    function normalizeCols(table, visibleColumns, hasDetails, groups) {
        var colgroup = table.find(">colgroup"),
            width,
            cols = map(visibleColumns, function(column) {
                    width = column.width;
                    if (width && parseInt(width, 10) !== 0) {
                        return kendo.format('<col style="width:{0}"/>', typeof width === STRING? width : width + "px");
                    }

                    return "<col />";
                });

        if (hasDetails || colgroup.find(".k-hierarchy-col").length) {
            cols.splice(0, 0, '<col class="k-hierarchy-col" />');
        }

        if (colgroup.length) {
            colgroup.remove();
        }

        colgroup = $("<colgroup/>").append($(new Array(groups + 1).join('<col class="k-group-col">') + cols.join("")));

        table.prepend(colgroup);
    }

    var Grid = Widget.extend({
        init: function(element, options) {
            var that = this;

            options = isArray(options) ? { dataSource: options } : options;

            Widget.fn.init.call(that, element, options);

            isRtl = kendo.support.isRtl(element);

            that._element();

            that._columns(that.options.columns);

            that._dataSource();

            that._tbody();

            that._pageable();

            that._thead();

            that._groupable();

            that._toolbar();

            that._setContentHeight();

            that._templates();

            that._navigatable();

            that._selectable();

            that._details();

            that._editable();

            that._attachCustomCommandsEvent();

            if (that.options.autoBind) {
                that.dataSource.fetch();
            } else {
                that._footer();
            }

            kendo.notify(that);
        },

        events: [
           CHANGE,
           "dataBinding",
           DATABOUND,
           DETAILEXPAND,
           DETAILCOLLAPSE,
           DETAILINIT,
           EDIT,
           SAVE,
           REMOVE,
           SAVECHANGES,
           COLUMNRESIZE,
           COLUMNREORDER,
           COLUMNSHOW,
           COLUMNHIDE
        ],

        setDataSource: function(dataSource) {
            var that = this;

            that.options.dataSource = dataSource;

            that._dataSource();

            that._pageable();

            if (that.options.groupable) {
                that._groupable();
            }

            that._thead();

            if (that.virtualScrollable) {
                that.virtualScrollable.setDataSource(that.options.dataSource);
            }

            if (that.options.autoBind) {
                dataSource.fetch();
            }
        },

        options: {
            name: "Grid",
            columns: [],
            toolbar: null,
            autoBind: true,
            filterable: false,
            scrollable: true,
            sortable: false,
            selectable: false,
            navigatable: false,
            pageable: false,
            editable: false,
            groupable: false,
            rowTemplate: "",
            altRowTemplate: "",
            dataSource: {},
            height: null,
            resizable: false,
            reorderable: false,
            columnMenu: false,
            detailTemplate: null
        },

        destroy: function() {
            var that = this;

            Widget.fn.destroy.call(that);

            if (that.pager) {
                that.pager.destroy();
            }

            if (that.groupable) {
                that.groupable.destroy();
            }

            if (that.virtualScrollable) {
                that.virtualScrollable.destroy();
            }

            that.thead.find("th").each(function(){
                var th = $(this),
                    filterMenu = th.data("kendoFilterMenu"),
                    sortable = th.data("kendoSortable"),
                    columnMenu = th.data("kendoColumnMenu");

                if (filterMenu) {
                    filterMenu.destroy();
                }

                if (sortable) {
                    sortable.destroy();
                }

                if (columnMenu) {
                    columnMenu.destroy();
                }
            });

            that._destroyEditable();

            that.dataSource.unbind(CHANGE, that._refreshHandler)
                           .unbind(REQUESTSTART, that._requestStartHandler)
                           .unbind(ERROR, that._errorHandler);

            that.element
                .add(that.wrapper)
                .add(that.table)
                .add(that.thead)
                .add(that.content)
                .add(that.content.find(">.k-virtual-scrollable-wrap"))
                .add(that.wrapper.find(">.k-grid-toolbar"))
                .off(NS);

            kendo.destroy(that.wrapper);
        },

        setOptions: function(options) {
            var that = this;

            Widget.fn.setOptions.call(this, options);

            that._templates();
        },

        items: function() {
            return this.tbody.children(':not(.k-grouping-row,.k-detail-row,.k-group-footer)');
        },

        _attachCustomCommandsEvent: function() {
            var that = this,
                columns = that.columns || [],
                command,
                idx,
                length;

            for (idx = 0, length = columns.length; idx < length; idx++) {
                command = columns[idx].command;

                if (command) {
                    attachCustomCommandEvent(that, that.wrapper, command);
                }
            }
        },

        _element: function() {
            var that = this,
                table = that.element;

            if (!table.is("table")) {
                if (that.options.scrollable) {
                    table = that.element.find("> .k-grid-content > table");
                } else {
                    table = that.element.children("table");
                }

                if (!table.length) {
                    table = $("<table />").appendTo(that.element);
                }
            }

            that.table = table.attr("cellspacing", 0);

            that._wrapper();
        },

        _positionColumnResizeHandle: function(container) {
            var that = this,
                scrollable = that.options.scrollable,
                resizeHandle = that.resizeHandle,
                left;

            that.thead.on("mousemove" + NS, "th:not(.k-group-cell,.k-hierarchy-cell)", function(e) {
                 var th = $(this),
                    position = th.offset().left + this.offsetWidth;

                if(e.clientX > position - indicatorWidth &&  e.clientX < position + indicatorWidth) {
                    cursor(that.wrapper, th.css('cursor'));

                    if (!resizeHandle) {
                        resizeHandle = that.resizeHandle = $('<div class="k-resize-handle"/>');
                        container.append(resizeHandle);
                    }

                    left = this.offsetWidth;

                    th.prevAll().each(function() {
                        left += this.offsetWidth;
                    });

                    resizeHandle.css({
                        top: scrollable ? 0 : heightAboveHeader(that.wrapper),
                        left: left - indicatorWidth,
                        height: th.outerHeight(),
                        width: indicatorWidth * 3
                    })
                    .data("th", th)
                    .show();

                } else {
                    cursor(that.wrapper, "");

                    if (resizeHandle) {
                       resizeHandle.hide();
                    }
                }
            });
        },

        _resizable: function() {
            var that = this,
                options = that.options,
                container,
                columnStart,
                columnWidth,
                gridWidth,
                col;

            if (options.resizable) {
                container = options.scrollable ? that.wrapper.find(".k-grid-header-wrap") : that.wrapper;

                that._positionColumnResizeHandle(container);

                container.kendoResizable({
                    handle: ".k-resize-handle",
                    hint: function(handle) {
                        return $('<div class="k-grid-resize-indicator" />').css({
                            height: handle.data("th").outerHeight() + that.tbody.attr("clientHeight")
                        });
                    },
                    start: function(e) {
                        var th = $(e.currentTarget).data("th"),
                            index = $.inArray(th[0], th.parent().children(":visible")),
                            contentTable = that.tbody.parent(),
                            footer = that.footer || $();

                        cursor(that.wrapper, th.css('cursor'));

                        if (options.scrollable) {
                            col = that.thead.parent().find("col:eq(" + index + ")")
                                .add(contentTable.children("colgroup").find("col:eq(" + index + ")"))
                                .add(footer.find("colgroup").find("col:eq(" + index + ")"));
                        } else {
                            col = contentTable.children("colgroup").find("col:eq(" + index + ")");
                        }

                        columnStart = e.x.location;
                        columnWidth = th.outerWidth();
                        gridWidth = that.tbody.outerWidth();
                    },
                    resize: function(e) {
                        var width = columnWidth + e.x.location - columnStart,
                            footer = that.footer || $();

                        if (width > 10) {
                            col.css('width', width);

                            if (options.scrollable) {
                                that._footerWidth = gridWidth + e.x.location - columnStart;
                                that.tbody.parent()
                                    .add(that.thead.parent())
                                    .add(footer.find("table"))
                                    .css('width', that._footerWidth);
                            }
                        }
                    },
                    resizeend: function(e) {
                        var th = $(e.currentTarget).data("th"),
                            newWidth = th.outerWidth(),
                            column;

                        cursor(that.wrapper, "");

                        if (columnWidth != newWidth) {
                            column = that.columns[th.parent().find("th:not(.k-group-cell,.k-hierarchy-cell)").index(th)];

                            column.width = newWidth;

                            that.trigger(COLUMNRESIZE, {
                                column: column,
                                oldWidth: columnWidth,
                                newWidth: newWidth
                            });
                        }
                        that.resizeHandle.hide();
                    }
                });
            }
        },

        _draggable: function() {
            var that = this;
            if (that.options.reorderable) {
                that._draggableInstance = that.thead.kendoDraggable({
                    group: kendo.guid(),
                    filter: ".k-header:not(.k-group-cell,.k-hierarchy-cell)",
                    hint: function(target) {
                        return $('<div class="k-header k-drag-clue" />')
                            .css({
                                width: target.width(),
                                paddingLeft: target.css("paddingLeft"),
                                paddingRight: target.css("paddingRight"),
                                lineHeight: target.height() + "px",
                                paddingTop: target.css("paddingTop"),
                                paddingBottom: target.css("paddingBottom")
                            })
                            .html(target.attr(kendo.attr("title")) || target.attr(kendo.attr("field")) || target.text())
                            .prepend('<span class="k-icon k-drag-status k-denied" />');
                    }
                }).data("kendoDraggable");
            }
        },

        _reorderable: function() {
            var that = this;
            if (that.options.reorderable) {
                that.thead.kendoReorderable({
                    draggable: that._draggableInstance,
                    change: function(e) {
                        var newIndex = inArray(that.columns[e.newIndex], that.columns),
                            column = that.columns[e.oldIndex];

                        that.trigger(COLUMNREORDER, {
                            newIndex: newIndex,
                            oldIndex: inArray(column, that.columns),
                            column: column
                        });
                        that.reorderColumn(newIndex, column);
                    }
                });
            }
        },

        reorderColumn: function(destIndex, column) {
            var that = this,
                sourceIndex = inArray(column, that.columns),
                colSourceIndex = inArray(column, visibleColumns(that.columns)),
                rows,
                idx,
                length,
                footer = that.footer || that.wrapper.find(".k-grid-footer");

            if (sourceIndex === destIndex) {
                return;
            }

            that.columns.splice(sourceIndex, 1);
            that.columns.splice(destIndex, 0, column);
            that._templates();

            reorder(that.thead.prev().find("col:not(.k-group-col,.k-hierarchy-col)"), colSourceIndex, destIndex);
            if (that.options.scrollable) {
                reorder(that.tbody.prev().find("col:not(.k-group-col,.k-hierarchy-col)"), colSourceIndex, destIndex);
            }

            reorder(that.thead.find(".k-header:not(.k-group-cell,.k-hierarchy-cell)"), sourceIndex, destIndex);

            if (footer && footer.length) {
                reorder(footer.find(".k-grid-footer-wrap>table>colgroup>col:not(.k-group-col,.k-hierarchy-col)"), colSourceIndex, destIndex);
                reorder(footer.find(".k-footer-template>td:not(.k-group-cell,.k-hierarchy-cell)"), sourceIndex, destIndex);
            }

            rows = that.tbody.children(":not(.k-grouping-row,.k-detail-row)");
            for (idx = 0, length = rows.length; idx < length; idx += 1) {
                reorder(rows.eq(idx).find(">td:not(.k-group-cell,.k-hierarchy-cell)"), sourceIndex, destIndex);
            }
        },

        cellIndex: function(td) {
            return $(td).parent().find('td:not(.k-group-cell,.k-hierarchy-cell)').index(td);
        },

        _modelForContainer: function(container) {
            container = $(container);

            if (!container.is("tr") && this._editMode() !== "popup") {
                container = container.closest("tr");
            }

            var id = container.attr(kendo.attr("uid"));

            return this.dataSource.getByUid(id);
        },

        _editable: function() {
            var that = this,
                editable = that.options.editable,
                handler = function () {
                    var target = document.activeElement,
                        cell = that._editContainer;

                    if (cell && !$.contains(cell[0], target) && cell[0] !== target && !$(target).closest(".k-animation-container").length) {
                        if (that.editable.end()) {
                            that.closeCell();
                        }
                    }
                };

            if (editable) {
                var mode = that._editMode();
                if (mode === "incell") {
                    if (editable.update !== false) {
                        that.wrapper.on(CLICK + NS, "tr:not(.k-grouping-row) > td", function(e) {
                            var td = $(this);

                            if (td.hasClass("k-hierarchy-cell") ||
                                td.hasClass("k-detail-cell") ||
                                td.hasClass("k-group-cell") ||
                                td.hasClass("k-edit-cell") ||
                                td.has("a.k-grid-delete").length ||
                                td.has("button.k-grid-delete").length ||
                                td.closest("tbody")[0] !== that.tbody[0] || $(e.target).is(":input")) {
                                return;
                            }

                            if (that.editable) {
                                if (that.editable.end()) {
                                    that.closeCell();
                                    that.editCell(td);
                                }
                            } else {
                                that.editCell(td);
                            }

                        })
                        .on("focusin" + NS, function(e) {
                            clearTimeout(that.timer);
                            that.timer = null;
                        })
                        .on("focusout" + NS, function(e) {
                            that.timer = setTimeout(handler, 1);
                        });
                    }
                } else {
                    if (editable.update !== false) {
                        that.wrapper.on(CLICK + NS, "tbody>tr:not(.k-detail-row,.k-grouping-row):visible a.k-grid-edit", function(e) {
                            e.preventDefault();
                            that.editRow($(this).closest("tr"));
                        });
                    }
                }

                if (editable.destroy !== false) {
                    that.wrapper.on(CLICK + NS, "tbody>tr:not(.k-detail-row,.k-grouping-row):visible .k-grid-delete", function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        that.removeRow($(this).closest("tr"));
                    });
                } else {
                    //Required for the MVC server wrapper delete button
                    that.wrapper.on(CLICK + NS, "tbody>tr:not(.k-detail-row,.k-grouping-row):visible button.k-grid-delete", function(e) {
                        if (!that._confirmation()) {
                            e.preventDefault();
                        }
                    });
                }
            }
        },

        editCell: function(cell) {
            var that = this,
                column = that.columns[that.cellIndex(cell)],
                model = that._modelForContainer(cell);


            if (model && (!model.editable || model.editable(column.field)) && !column.command && column.field) {

                that._attachModelChange(model);

                that._editContainer = cell;

                that.editable = cell.addClass("k-edit-cell")
                    .kendoEditable({
                        fields: { field: column.field, format: column.format, editor: column.editor, values: column.values },
                        model: model,
                        change: function(e) {
                            if (that.trigger(SAVE, { values: e.values, container: cell, model: model } )) {
                                e.preventDefault();
                            }
                        }
                    }).data("kendoEditable");

                cell.parent().addClass("k-grid-edit-row");

                that.trigger(EDIT, { container: cell, model: model });
            }
        },

        _destroyEditable: function() {
            var that = this;

            var destroy = function() {
                if (that.editable) {
                    that._detachModelChange();
                    that.editable.destroy();
                    that.editable = null;
                    that._editContainer = null;
                }
            };

            if (that.editable) {
                if (that._editMode() === "popup") {
                    that._editContainer.data("kendoWindow").bind("deactivate", destroy).close();
                } else {
                    destroy();
                }
            }
        },

        _attachModelChange: function(model) {
            var that = this;

            that._modelChangeHandler = function(e) {
                that._modelChange({ field: e.field, model: this });
            };

            model.bind("change", that._modelChangeHandler);
        },

        _detachModelChange: function() {
            var that = this,
                container = that._editContainer,
                model = that._modelForContainer(container);

            if (model) {
                model.unbind(CHANGE, that._modelChangeHandler);
            }
        },

        closeCell: function() {
            var that = this,
                cell = that._editContainer.removeClass("k-edit-cell"),
                id = cell.closest("tr").attr(kendo.attr("uid")),
                column = that.columns[that.cellIndex(cell)],
                model = that.dataSource.getByUid(id);

            cell.parent().removeClass("k-grid-edit-row");

            that._destroyEditable(); // editable should be destoryed before content of the container is changed

            that._displayCell(cell, column, model);

            if (cell.hasClass("k-dirty-cell")) {
                $('<span class="k-dirty"/>').prependTo(cell);
            }
        },

        _displayCell: function(cell, column, dataItem) {
            var that = this,
                state = { storage: {}, count: 0 },
                settings = extend({}, kendo.Template, that.options.templateSettings),
                tmpl = kendo.template(that._cellTmpl(column, state), settings);

            if (state.count > 0) {
                tmpl = proxy(tmpl, state.storage);
            }

            cell.empty().html(tmpl(dataItem));
        },

        removeRow: function(row) {
            var that = this,
                model,
                mode;

            if (!that._confirmation()) {
                return;
            }

            row = $(row).hide();
            model = that._modelForContainer(row);

            if (model && !that.trigger(REMOVE, { row: row, model: model })) {
                that.dataSource.remove(model);

                mode = that._editMode();

                if (mode === "inline" || mode === "popup") {
                    that.dataSource.sync();
                }
            }
        },

        _editMode: function() {
            var mode = "incell",
                editable = this.options.editable;

            if (editable !== true) {
                if (typeof editable == "string") {
                    mode = editable;
                } else {
                    mode = editable.mode || mode;
                }
            }

            return mode;
        },

        editRow: function(row) {
            var that = this,
                model = that._modelForContainer(row),
                mode = that._editMode(),
                container;

            that.cancelRow();

            if (model) {

                that._attachModelChange(model);

                if (mode === "popup") {
                    that._createPopupEditor(model);
                } else if (mode === "inline") {
                    that._createInlineEditor(row, model);
                } else if (mode === "incell") {
                    $(row).children(DATA_CELL).each(function() {
                        var cell = $(this);
                        var column = that.columns[cell.index()];

                        model = that._modelForContainer(cell);

                        if (model && (!model.editable || model.editable(column.field)) && column.field) {
                            that.editCell(cell);
                            return false;
                        }
                    });
                }

                container = that._editContainer;

                container.on(CLICK + NS, "a.k-grid-cancel", function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    that.cancelRow();
                });

                container.on(CLICK + NS, "a.k-grid-update", function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    that.saveRow();
                });
            }
        },

        _createPopupEditor: function(model) {
            var that = this,
                html = '<div ' + kendo.attr("uid") + '="' + model.uid + '"><div class="k-edit-form-container">',
                column,
                command,
                fields = [],
                idx,
                length,
                tmpl,
                updateText,
                cancelText,
                attr,
                editable = that.options.editable,
                template = editable.template,
                options = isPlainObject(editable) ? editable.window : {},
                settings = extend({}, kendo.Template, that.options.templateSettings);

            if (template) {
                if (typeof template === STRING) {
                    template = window.unescape(template);
                }

                html += (kendo.template(template, settings))(model);

                for (idx = 0, length = that.columns.length; idx < length; idx++) {
                    column = that.columns[idx];
                    if (column.command) {
                        command = getCommand(column.command, "edit");
                    }
                }
            } else {
                for (idx = 0, length = that.columns.length; idx < length; idx++) {
                    column = that.columns[idx];

                    if (!column.command) {
                        html += '<div class="k-edit-label"><label for="' + column.field + '">' + (column.title || column.field || "") + '</label></div>';

                        if ((!model.editable || model.editable(column.field)) && column.field) {
                            fields.push({ field: column.field, format: column.format, editor: column.editor, values: column.values });
                            html += '<div ' + kendo.attr("container-for") + '="' + column.field + '" class="k-edit-field"></div>';
                        } else {
                            var state = { storage: {}, count: 0 };

                            tmpl = kendo.template(that._cellTmpl(column, state), settings);

                            if (state.count > 0) {
                                tmpl = proxy(tmpl, state.storage);
                            }

                            html += '<div class="k-edit-field">' + tmpl(model) + '</div>';
                        }
                    } else if (column.command) {
                        command = getCommand(column.command, "edit");
                    }
                }
            }

            if (command) {
                if (isPlainObject(command)) {
                   if (command.text && isPlainObject(command.text)) {
                       updateText = command.text.update;
                       cancelText = command.text.cancel;
                   }

                   if (command.attr) {
                       attr = command.attr;
                   }
                }
            }

            html += that._createButton({ name: "update", text: updateText, attr: attr }) + that._createButton({ name: "canceledit", text: cancelText, attr: attr });
            html += '</div></div>';

            var container = that._editContainer = $(html)
                .appendTo(that.wrapper).eq(0)
                .kendoWindow(extend({
                    modal: true,
                    resizable: false,
                    draggable: true,
                    title: "Edit",
                    visible: false
                }, options));

            var wnd = container.data("kendoWindow");

            wnd.wrapper.on(CLICK + NS, "a:has(.k-i-close)", function() {
                that.cancelRow();
            });

            that.editable = that._editContainer
                .kendoEditable({
                    fields: fields,
                    model: model,
                    clearContainer: false
                }).data("kendoEditable");

            wnd.center().open();

            that.trigger(EDIT, { container: container, model: model });
        },

        _createInlineEditor: function(row, model) {
            var that = this,
                column,
                cell,
                command,
                fields = [];

            row.children(":not(.k-group-cell,.k-hierarchy-cell)").each(function() {
                cell = $(this);
                column = that.columns[that.cellIndex(cell)];

                if (!column.command && column.field && (!model.editable || model.editable(column.field))) {
                    fields.push({ field: column.field, format: column.format, editor: column.editor, values: column.values });
                    cell.attr("data-container-for", column.field);
                    cell.empty();
                } else if (column.command) {
                    command = getCommand(column.command, "edit");
                    if (command) {
                        cell.empty();

                        var updateText,
                            cancelText,
                            attr;

                        if (isPlainObject(command)) {
                            if (command.text && isPlainObject(command.text)) {
                                updateText = command.text.update;
                                cancelText = command.text.cancel;
                            }

                            if (command.attr) {
                                attr = command.attr;
                            }
                        }

                        $(that._createButton({ name: "update", text: updateText, attr: attr }) +
                            that._createButton({ name: "canceledit", text: cancelText, attr: attr})).appendTo(cell);
                    }
                }
            });

            that._editContainer = row;

            that.editable = row
                .addClass("k-grid-edit-row")
                .kendoEditable({
                    fields: fields,
                    model: model,
                    clearContainer: false
                }).data("kendoEditable");

            that.trigger(EDIT, { container: row, model: model });
        },

        cancelRow: function() {
            var that = this,
                container = that._editContainer,
                model;

            if (container) {
                model = that._modelForContainer(container);

                that.dataSource.cancelChanges(model);

                if (that._editMode() !== "popup") {
                    that._displayRow(container);
                } else {
                    that._displayRow(that.items().filter("[" + kendo.attr("uid") + "=" + model.uid + "]"));
                }

                that._destroyEditable();
            }
        },

        saveRow: function() {
            var that = this,
                container = that._editContainer,
                model = that._modelForContainer(container),
                editable = that.editable;

            if (container && editable && editable.end() &&
                !that.trigger(SAVE, { container: container, model: model } )) {

                if (that._editMode() !== "popup") {
                    that._displayRow(container);
                }

                that._destroyEditable();
                that.dataSource.sync();
            }
        },

        _displayRow: function(row) {
            var that = this,
                model = that._modelForContainer(row);

            if (model) {
                row.replaceWith($((row.hasClass("k-alt") ? that.altRowTemplate : that.rowTemplate)(model)));
            }
        },

        _showMessage: function(text) {
            return window.confirm(text);
        },

        _confirmation: function() {
            var that = this,
                editable = that.options.editable,
                confirmation = editable === true || typeof editable === STRING ? DELETECONFIRM : editable.confirmation;

            return confirmation !== false && confirmation != null ? that._showMessage(confirmation) : true;
        },

        cancelChanges: function() {
            this.dataSource.cancelChanges();
        },

        saveChanges: function() {
            var that = this;

            if (((that.editable && that.editable.end()) || !that.editable) && !that.trigger(SAVECHANGES)) {
                that.dataSource.sync();
            }
        },

        addRow: function() {
            var that = this,
                index,
                dataSource = that.dataSource,
                mode = that._editMode(),
                createAt = that.options.editable.createAt || "",
                pageSize = dataSource.pageSize(),
                view = dataSource.view() || [];

            if ((that.editable && that.editable.end()) || !that.editable) {
                if (mode != "incell") {
                    that.cancelRow();
                }

                index = dataSource.indexOf(view[0]);

                if (createAt.toLowerCase() == "bottom") {
                    index += view.length;

                    if (pageSize && !dataSource.options.serverPaging && pageSize <= view.length) {
                        index -= 1;
                    }
                }

                if (index < 0) {
                    index = 0;
                }

                var model = dataSource.insert(index, {}),
                    id = model.uid,
                    row = that.table.find("tr[" + kendo.attr("uid") + "=" + id + "]"),
                    cell = row.children("td:not(.k-group-cell,.k-hierarchy-cell)").first();

                if ((mode === "inline" || mode === "popup") && row.length) {
                    that.editRow(row);
                } else if (cell.length) {
                    that.editCell(cell);
                }
            }
        },

        _toolbar: function() {
            var that = this,
                wrapper = that.wrapper,
                toolbar = that.options.toolbar,
                editable = that.options.editable,
                container,
                template;

            if (toolbar) {
                container = that.wrapper.find(".k-grid-toolbar");

                if (!container.length) {
                    toolbar = isFunction(toolbar) ? toolbar({}) : (typeof toolbar === STRING ? toolbar : that._toolbarTmpl(toolbar).replace(templateHashRegExp, "\\#"));

                    template = proxy(kendo.template(toolbar), that);

                    container = $('<div class="k-toolbar k-grid-toolbar" />')
                        .html(template({}))
                        .prependTo(wrapper);
                }

                if (editable && editable.create !== false) {
                    container.on(CLICK + NS, ".k-grid-add", function(e) { e.preventDefault(); that.addRow(); })
                        .on(CLICK + NS, ".k-grid-cancel-changes", function(e) { e.preventDefault(); that.cancelChanges(); })
                        .on(CLICK + NS, ".k-grid-save-changes", function(e) { e.preventDefault(); that.saveChanges(); });
                }
            }
        },

        _toolbarTmpl: function(commands) {
            var that = this,
                idx,
                length,
                html = "";

            if (isArray(commands)) {
                for (idx = 0, length = commands.length; idx < length; idx++) {
                    html += that._createButton(commands[idx]);
                }
            }
            return html;
        },

        _createButton: function(command) {
            var template = command.template || COMMANDBUTTONTMPL,
                commandName = typeof command === STRING ? command : command.name || command.text,
                options = { className: "k-grid-" + (commandName || "").replace(/\s/g, ""), text: commandName, imageClass: "", attr: "", iconClass: "" };

            if (!commandName && !(isPlainObject(command) && command.template))  {
                throw new Error("Custom commands should have name specified");
            }

            if (isPlainObject(command)) {
                if (command.className) {
                    command.className += " " + options.className;
                }

                if (commandName === "edit" && isPlainObject(command.text)) {
                    command = extend(true, {}, command);
                    command.text = command.text.edit;
                }

                if (command.attr && isPlainObject(command.attr)) {
                    command.attr = stringifyAttributes(command.attr);
                }

                options = extend(true, options, defaultCommands[commandName], command);
            } else {
                options = extend(true, options, defaultCommands[commandName]);
            }

            return kendo.template(template)(options);
        },

        _groupable: function() {
            var that = this,
                wrapper = that.wrapper,
                groupable = that.options.groupable;

            if (!that.groupable) {
                that.table.on(CLICK + NS, ".k-grouping-row .k-i-collapse, .k-grouping-row .k-i-expand", function(e) {
                    var element = $(this),
                    group = element.closest("tr");

                    if(element.hasClass('k-i-collapse')) {
                        that.collapseGroup(group);
                    } else {
                        that.expandGroup(group);
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
            }

            if (groupable) {
                if(!wrapper.has("div.k-grouping-header")[0]) {
                    $("<div />").addClass("k-grouping-header").html("&nbsp;").prependTo(wrapper);
                }

                if (that.groupable) {
                    that.groupable.destroy();
                }

                that.groupable = new Groupable(wrapper, extend({}, groupable, {
                    draggable: that._draggableInstance,
                    groupContainer: ">div.k-grouping-header",
                    dataSource: that.dataSource,
                    filter: ".k-header:not(.k-group-cell,.k-hierarchy-cell):visible[" + kendo.attr("field") + "]",
                    allowDrag: that.options.reorderable
                }));
            }
        },

        _selectable: function() {
            var that = this,
                multi,
                cell,
                selectable = that.options.selectable;

            if (selectable) {
                multi = typeof selectable === STRING && selectable.toLowerCase().indexOf("multiple") > -1;
                cell = typeof selectable === STRING && selectable.toLowerCase().indexOf("cell") > -1;

                that.selectable = new kendo.ui.Selectable(that.table, {
                    filter: ">" + (cell ? SELECTION_CELL_SELECTOR : "tbody>tr:not(.k-grouping-row,.k-detail-row,.k-group-footer)"),
                    multiple: multi,
                    change: function() {
                        that.trigger(CHANGE);
                    }
                });

                if (that.options.navigatable) {
                    that.wrapper.keydown(function(e) {
                        var current = that.current();
                        if (e.keyCode === keys.SPACEBAR && e.target == that.wrapper[0] && !current.hasClass("k-edit-cell")) {
                            e.preventDefault();
                            e.stopPropagation();
                            current = cell ? current : current.parent();

                            if(multi) {
                                if(!e.ctrlKey) {
                                    that.selectable.clear();
                                } else {
                                    if(current.hasClass(SELECTED)) {
                                        current.removeClass(SELECTED);
                                        current = null;
                                    }
                                }
                            } else {
                                that.selectable.clear();
                            }

                            that.selectable.value(current);
                        }
                    });
                }
            }
        },

        clearSelection: function() {
            var that = this;
            that.selectable.clear();
            that.trigger(CHANGE);
        },

        select: function(items) {
            var that = this,
                selectable = that.selectable;

            items = $(items);
            if(items.length) {
                if(!selectable.options.multiple) {
                    selectable.clear();
                    items = items.first();
                }
                selectable.value(items);
                return;
            }

            return selectable.value();
        },

        current: function(element) {
            var that = this,
                scrollable = that.options.scrollable,
                current = that._current;

            if (element !== undefined && element.length) {
                if (!current || current[0] !== element[0]) {
                    element.addClass(FOCUSED);
                    if (current) {
                        current.removeClass(FOCUSED);
                    }
                    that._current = element;

                    if(element.length && scrollable) {
                        that._scrollTo(element.parent()[0], that.content[0]);
                        if (scrollable.virtual) {
                            that._scrollTo(element[0], that.content.find(">.k-virtual-scrollable-wrap")[0]);
                        } else {
                            that._scrollTo(element[0], that.content[0]);
                        }
                    }
                }
            }

            return that._current;
        },

        _scrollTo: function(element, container) {
            var isHorizontal =  element.tagName.toLowerCase() === "td",
                elementOffset = element[isHorizontal ? "offsetLeft" : "offsetTop"],
                elementOffsetDir = element[isHorizontal ? "offsetWidth" : "offsetHeight"],
                containerScroll = container[isHorizontal ? "scrollLeft" : "scrollTop"],
                containerOffsetDir = container[isHorizontal ? "clientWidth" : "clientHeight"],
                bottomDistance = elementOffset + elementOffsetDir;

            container[isHorizontal ? "scrollLeft" : "scrollTop"] = containerScroll > elementOffset ?
                                    elementOffset :
                                    (bottomDistance > (containerScroll + containerOffsetDir) ?
                                        (bottomDistance - containerOffsetDir) : containerScroll);
        },

        _navigatable: function() {
            var that = this,
                wrapper = that.wrapper,
                table = that.table.addClass(FOCUSABLE),
                currentProxy = proxy(that.current, that),
                selector = "." + FOCUSABLE + " " + CELL_SELECTOR,
                browser = kendo.support.browser,
                clickCallback = function(e) {
                    var currentTarget = $(e.currentTarget);
                    if (currentTarget.closest("tbody")[0] !== that.tbody[0]) {
                        return;
                    }

                    currentProxy(currentTarget);
                    if(!$(e.target).is(":button,a,:input,a>.k-icon,textarea,span.k-icon,.k-input")) {
                        setTimeout(function() { wrapper.focus(); } );
                    }

                    e.stopPropagation();
                };

            if (that.options.navigatable) {
                wrapper.on("focus" + NS, function() {
                    var current = that._current;
                    if(current && current.is(":visible")) {
                        current.addClass(FOCUSED);
                    } else {
                        currentProxy(that.table.find(FIRST_CELL_SELECTOR));
                    }
                })
                .on("focusout" + NS, function(e) {
                    if (that._current) {
                        that._current.removeClass(FOCUSED);
                    }
                    e.stopPropagation();
                })
                .on("keydown" + NS, function(e) {
                    var key = e.keyCode,
                        current = that.current(),
                        shiftKey = e.shiftKey,
                        dataSource = that.dataSource,
                        pageable = that.options.pageable,
                        canHandle = !$(e.target).is(":button,a,:input,a>.t-icon"),
                        isInCell = that._editMode() == "incell",
                        currentIndex,
                        cell,
                        handled = false;

                    if (canHandle && keys.UP === key) {
                        currentProxy(current ? current.parent().prevAll(ROW_SELECTOR).first().children()
                            .eq(current.index() >= 0 ? current.index() : 0).last() : table.find(FIRST_CELL_SELECTOR));

                        handled = true;
                    } else if (canHandle && keys.DOWN === key) {
                        currentProxy(current ? current.parent().nextAll(ROW_SELECTOR).first().children()
                            .eq(current.index() >= 0 ? current.index() : 0).last() : table.find(FIRST_CELL_SELECTOR));

                        handled = true;
                    } else if (canHandle && keys.LEFT === key) {
                        currentProxy(current ? current.prevAll(DATA_CELL + ":first") : table.find(FIRST_CELL_SELECTOR));
                        handled = true;
                    } else if (canHandle && keys.RIGHT === key) {
                        currentProxy(current ? current.nextAll(":visible:first") : table.find(FIRST_CELL_SELECTOR));
                        handled = true;
                    } else if (canHandle && pageable && keys.PAGEDOWN == key) {
                        that._current = null;
                        dataSource.page(dataSource.page() + 1);
                        handled = true;
                    } else if (canHandle && pageable && keys.PAGEUP == key) {
                        that._current = null;
                        dataSource.page(dataSource.page() - 1);
                        handled = true;
                    } else if (that.options.editable) {
                        current = current ? current : table.find(FIRST_CELL_SELECTOR);
                        if (keys.ENTER == key || keys.F2 == key) {
                            that._handleEditing(current);
                            handled = true;
                        } else if (keys.TAB == key && isInCell) {
                            cell = shiftKey ? current.prevAll(DATA_CELL + ":first") : current.nextAll(":visible:first");
                            if (!cell.length) {
                                cell = current.parent()[shiftKey ? "prevAll" : "nextAll"]("tr:not(.k-grouping-row,.k-detail-row):visible")
                                    .children(DATA_CELL + (shiftKey ? ":last" : ":first"));
                            }

                            if (cell.length) {
                                that._handleEditing(current, cell);
                                handled = true;
                            }
                        } else if (keys.ESC == key && that._editContainer) {
                            if (that._editContainer.has(current[0]) || current[0] === that._editContainer[0]) {
                                if (isInCell) {
                                    that.closeCell();
                                } else {
                                    currentIndex = that.items().index(current.parent());
                                    document.activeElement.blur();
                                    that.cancelRow();
                                    if (currentIndex >= 0) {
                                        that.current(that.items().eq(currentIndex).children().filter(DATA_CELL).first());
                                    }
                                }

                                if (browser.msie && parseInt(browser.version, 10) < 9) {
                                    document.body.focus();
                                }
                                wrapper.focus();
                                handled = true;
                            }
                        }
                    }

                    if(handled) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                })
                .on("mousedown" + NS, selector, clickCallback); }
        },

        _handleEditing: function(current, next) {
            var that = this,
                mode = that._editMode(),
                editContainer = that._editContainer,
                idx,
                isEdited;

            if (mode == "incell") {
                isEdited = current.hasClass("k-edit-cell");
            } else {
                isEdited = current.parent().hasClass("k-grid-edit-row");
            }

            if (that.editable) {
                if ($.contains(editContainer[0], document.activeElement)) {
                    $(document.activeElement).blur();
                }

                if (that.editable.end()) {
                    if (mode == "incell") {
                        that.closeCell();
                    } else {
                        if (current.parent()[0] === editContainer[0]) {
                            idx = that.items().index(current.parent());
                        } else {
                            idx = that.items().index(editContainer);
                        }
                        that.saveRow();
                        that.current(that.items().eq(idx).children().filter(DATA_CELL).first());
                        isEdited = true;
                    }
                } else {
                    if (mode == "incell") {
                        that.current(editContainer);
                    } else {
                        that.current(editContainer.children().filter(DATA_CELL).first());
                    }
                    editContainer.find(":input:visible:first").focus();
                    return;
                }
            }

            if (next) {
                that.current(next);
            }

            that.wrapper.focus();
            if ((!isEdited && !next) || next) {
                if (mode == "incell") {
                    that.editCell(that.current());
                } else {
                    that.editRow(that.current().parent());
                }
            }
        },

        _wrapper: function() {
            var that = this,
                table = that.table,
                height = that.options.height,
                wrapper = that.element;

            if (!wrapper.is("div")) {
               wrapper = wrapper.wrap("<div/>").parent();
            }

            that.wrapper = wrapper.addClass("k-grid k-widget")
                                  .attr(TABINDEX, math.max(table.attr(TABINDEX) || 0, 0));

            table.removeAttr(TABINDEX);

            if (height) {
                that.wrapper.css(HEIGHT, height);
                table.css(HEIGHT, "auto");
            }
        },

        _tbody: function() {
            var that = this,
                table = that.table,
                tbody;

            tbody = table.find(">tbody");

            if (!tbody.length) {
                tbody = $("<tbody/>").appendTo(table);
            }

            that.tbody = tbody;
        },

        _scrollable: function() {
            var that = this,
                header,
                table,
                options = that.options,
                scrollable = options.scrollable,
                scrollbar = kendo.support.scrollbar();

            if (scrollable) {
                header = that.wrapper.children(".k-grid-header");

                if (!header[0]) {
                    header = $('<div class="k-grid-header" />').insertBefore(that.table);
                }

                // workaround for IE issue where scroll is not raised if container is same width as the scrollbar
                header.css((isRtl ? "padding-left" : "padding-right"), scrollable.virtual ? scrollbar + 1 : scrollbar);
                table = $('<table cellspacing="0" />');
                table.append(that.thead);
                header.empty().append($('<div class="k-grid-header-wrap" />').append(table));

                that.content = that.table.parent();

                if (that.content.is(".k-virtual-scrollable-wrap")) {
                    that.content = that.content.parent();
                }

                if (!that.content.is(".k-grid-content, .k-virtual-scrollable-wrap")) {
                    that.content = that.table.wrap('<div class="k-grid-content" />').parent();
                }
                if (scrollable !== true && scrollable.virtual && !that.virtualScrollable) {
                    that.virtualScrollable = new VirtualScrollable(that.content, {
                        dataSource: that.dataSource,
                        itemHeight: proxy(that._averageRowHeight, that)
                    });
                }

                that.scrollables = header.children(".k-grid-header-wrap");

                // the footer may exists if rendered from the server
                var footer = that.wrapper.find(".k-grid-footer");
                if (footer.length) {
                    that.scrollables = that.scrollables.add(footer.children(".k-grid-footer-wrap"));
                }

                if (scrollable.virtual) {
                    that.content.find(">.k-virtual-scrollable-wrap").bind("scroll" + NS, function () {
                        that.scrollables.scrollLeft(this.scrollLeft);
                    });
                } else {
                    that.content.bind("scroll" + NS, function () {
                        that.scrollables.scrollLeft(this.scrollLeft);
                    });

                    var touchScroller = kendo.touchScroller(that.content);
                    if (touchScroller && touchScroller.movable) {
                        touchScroller.movable.bind("change", function(e) {
                            that.scrollables.scrollLeft(-e.sender.x);
                        });
                    }
                }
            }
        },

        _setContentHeight: function() {
            var that = this,
                options = that.options,
                height = that.wrapper.innerHeight(),
                header = that.wrapper.children(".k-grid-header"),
                scrollbar = kendo.support.scrollbar();

            if (options.scrollable) {

                height -= header.outerHeight();

                if (that.pager) {
                    height -= that.pager.element.outerHeight();
                }

                if(options.groupable) {
                    height -= that.wrapper.children(".k-grouping-header").outerHeight();
                }

                if(options.toolbar) {
                    height -= that.wrapper.children(".k-grid-toolbar").outerHeight();
                }

                if (that.footerTemplate) {
                    height -= that.wrapper.children(".k-grid-footer").outerHeight();
                }

                var isGridHeightSet = function(el) {
                    var initialHeight, newHeight;
                    if (el[0].style.height) {
                        return true;
                    } else {
                        initialHeight = el.height();
                    }

                    el.height("auto");
                    newHeight = el.height();

                    if (initialHeight != newHeight) {
                        el.height("");
                        return true;
                    }
                    el.height("");
                    return false;
                };

                if (isGridHeightSet(that.wrapper)) { // set content height only if needed
                    if (height > scrollbar * 2) { // do not set height if proper scrollbar cannot be displayed
                        that.content.height(height);
                    } else {
                        that.content.height(scrollbar * 2 + 1);
                    }
                }
            }
        },

        _averageRowHeight: function() {
            var that = this,
                rowHeight = that._rowHeight;

            if (!that._rowHeight) {
                that._rowHeight = rowHeight = that.table.outerHeight() / that.table[0].rows.length;
                that._sum = rowHeight;
                that._measures = 1;
            }

            var currentRowHeight = that.table.outerHeight() / that.table[0].rows.length;

            if (rowHeight !== currentRowHeight) {
                that._measures ++;
                that._sum += currentRowHeight;
                that._rowHeight = that._sum / that._measures;
            }
            return rowHeight;
        },

        _dataSource: function() {
            var that = this,
                options = that.options,
                pageable,
                dataSource = options.dataSource;

            dataSource = isArray(dataSource) ? { data: dataSource } : dataSource;

            if (isPlainObject(dataSource)) {
                extend(dataSource, { table: that.table, fields: that.columns });

                pageable = options.pageable;

                if (isPlainObject(pageable) && pageable.pageSize !== undefined) {
                    dataSource.pageSize = pageable.pageSize;
                }
            }

            if (that.dataSource && that._refreshHandler) {
                that.dataSource.unbind(CHANGE, that._refreshHandler)
                                .unbind(REQUESTSTART, that._requestStartHandler)
                                .unbind(ERROR, that._errorHandler);
            } else {
                that._refreshHandler = proxy(that.refresh, that);
                that._requestStartHandler = proxy(that._requestStart, that);
                that._errorHandler = proxy(that._error, that);
            }

            that.dataSource = DataSource.create(dataSource)
                                .bind(CHANGE, that._refreshHandler)
                                .bind(REQUESTSTART, that._requestStartHandler)
                                .bind(ERROR, that._errorHandler);
        },

        _error: function() {
            this._progress(false);
        },

        _requestStart: function() {
            this._progress(true);
        },

        _modelChange: function(e) {
            var that = this,
                model = e.model,
                row = that.tbody.find("tr[" + kendo.attr("uid") + "=" + model.uid +"]"),
                cell,
                column,
                isAlt = row.hasClass("k-alt"),
                tmp,
                idx,
                length;

            if (row.children(".k-edit-cell").length && !that.options.rowTemplate) {
                row.children(":not(.k-group-cell,.k-hierarchy-cell)").each(function() {
                    cell = $(this);
                    column = that.columns[that.cellIndex(cell)];

                    if (column.field === e.field) {
                        if (!cell.hasClass("k-edit-cell")) {
                            that._displayCell(cell, column, model);
                            $('<span class="k-dirty"/>').prependTo(cell);
                        } else {
                            cell.addClass("k-dirty-cell");
                        }
                    }
                });

            } else if (!row.hasClass("k-grid-edit-row")) {
                tmp = $((isAlt ? that.altRowTemplate : that.rowTemplate)(model));

                row.replaceWith(tmp);

                for (idx = 0, length = that.columns.length; idx < length; idx++) {
                    column = that.columns[idx];

                    if (column.field === e.field) {
                        cell = tmp.children(":not(.k-group-cell,.k-hierarchy-cell)").eq(idx);
                        $('<span class="k-dirty"/>').prependTo(cell);
                    }
                }
                that.trigger("itemChange", { item: tmp, data: model, ns: ui });
            }

        },

        _pageable: function() {
            var that = this,
                wrapper,
                pageable = that.options.pageable;

            if (pageable) {
                wrapper = that.wrapper.children("div.k-grid-pager");

                if (!wrapper.length) {
                    wrapper = $('<div class="k-pager-wrap k-grid-pager"/>').appendTo(that.wrapper);
                }

                if (that.pager) {
                    that.pager.destroy();
                }

                if (typeof pageable === "object" && pageable instanceof kendo.ui.Pager) {
                    that.pager = pageable;
                } else {
                    that.pager = new kendo.ui.Pager(wrapper, extend({}, pageable, { dataSource: that.dataSource }));
                }
            }
        },

        _footer: function() {
            var that = this,
                aggregates = that.dataSource.aggregates(),
                html = "",
                footerTemplate = that.footerTemplate,
                options = that.options,
                footer;

            if (footerTemplate) {
                aggregates = !isEmptyObject(aggregates) ? aggregates : buildEmptyAggregatesObject(that.dataSource.aggregate());

                html = $(that._wrapFooter(footerTemplate(aggregates)));
                footer = that.footer || that.wrapper.find(".k-grid-footer");

                if (footer.length) {
                    var tmp = html;

                    footer.replaceWith(tmp);
                    that.footer = tmp;
                } else {
                    if (options.scrollable) {
                        that.footer = options.pageable ? html.insertBefore(that.wrapper.children("div.k-grid-pager")) : html.appendTo(that.wrapper);
                    } else {
                        that.footer = html.insertBefore(that.tbody);
                    }
                }

                if (options.scrollable) {
                    that.scrollables = that.scrollables
                        .not(".k-grid-footer-wrap")
                        .add(that.footer.children(".k-grid-footer-wrap"));
                }

                if (options.resizable && that._footerWidth) {
                    that.footer.find("table").css('width', that._footerWidth);
                }
            }
        },

        _wrapFooter: function(footerRow) {
            var that = this,
                html = "";

            if (that.options.scrollable) {
                html = $('<div class="k-grid-footer"><div class="k-grid-footer-wrap"><table cellspacing="0"><tbody>' + footerRow + '</tbody></table></div></div>');
                that._appendCols(html.find("table"));
                html.css((isRtl ? "padding-left" : "padding-right"), kendo.support.scrollbar()); // Update inner fix.

                return html;
            }

            return '<tfoot class="k-grid-footer">' + footerRow + '</tfoot>';
        },

        _columnMenu: function() {
            var that = this,
                menu,
                columns = that.columns,
                column,
                options = that.options,
                columnMenu = options.columnMenu,
                menuOptions,
                sortable,
                filterable,
                cell;

            if (columnMenu) {
                if (typeof columnMenu == "boolean") {
                    columnMenu = {};
                }

                that.thead
                    .find("th:not(.k-hierarchy-cell,.k-group-cell)")
                    .each(function (index) {
                        column = columns[index];
                        cell = $(this);

                        if (!column.command && (column.field || cell.attr("data-" + kendo.ns + "field"))) {
                            menu = cell.data("kendoColumnMenu");
                            if (menu) {
                                menu.destroy();
                            }
                            sortable = column.sortable !== false && columnMenu.sortable !== false ? options.sortable : false;
                            filterable = options.filterable && column.filterable !== false && columnMenu.filterable !== false ? extend({}, column.filterable, options.filterable) : false;
                            menuOptions = {
                                dataSource: that.dataSource,
                                values: column.values,
                                columns: columnMenu.columns,
                                sortable: sortable,
                                filterable: filterable,
                                messages: columnMenu.messages,
                                owner: that
                            };

                            cell.kendoColumnMenu(menuOptions);
                        }
                    });
            }
        },

        _filterable: function() {
            var that = this,
                columns = that.columns,
                cell,
                filterMenu,
                filterable = that.options.filterable;

            if (filterable && !that.options.columnMenu) {
                that.thead
                    .find("th:not(.k-hierarchy-cell,.k-group-cell)")
                    .each(function(index) {
                        cell = $(this);
                        if (columns[index].filterable !== false && !columns[index].command && (columns[index].field || cell.attr("data-" + kendo.ns + "field"))) {
                            filterMenu = cell.data("kendoFilterMenu");
                            if (filterMenu) {
                                filterMenu.destroy();
                            }
                            cell.kendoFilterMenu(extend(true, {}, filterable, columns[index].filterable, { dataSource: that.dataSource, values: columns[index].values}));
                        }
                    });
            }
        },

        _sortable: function() {
            var that = this,
                columns = that.columns,
                column,
                sortable = that.options.sortable;

            if (sortable) {
                that.thead
                    .find("th:not(.k-hierarchy-cell,.k-group-cell)")
                    .each(function(index) {
                        column = columns[index];
                        if (column.sortable !== false && !column.command && column.field) {
                            $(this).attr("data-" + kendo.ns +"field", column.field).kendoSortable(extend({}, sortable, { dataSource: that.dataSource }));
                        }
                    });
            }
        },

        _columns: function(columns) {
            var that = this,
                table = that.table,
                encoded,
                cols = table.find("col"),
                dataSource = that.options.dataSource;

            // using HTML5 data attributes as a configuration option e.g. <th data-field="foo">Foo</foo>
            columns = columns.length ? columns : map(table.find("th"), function(th, idx) {
                th = $(th);
                var sortable = th.attr(kendo.attr("sortable")),
                    filterable = th.attr(kendo.attr("filterable")),
                    type = th.attr(kendo.attr("type")),
                    groupable = th.attr(kendo.attr("groupable")),
                    field = th.attr(kendo.attr("field")),
                    menu = th.attr(kendo.attr("menu"));

                if (!field) {
                   field = th.text().replace(/\s|[^A-z0-9]/g, "");
                }

                return {
                    field: field,
                    type: type,
                    sortable: sortable !== "false",
                    filterable: filterable !== "false",
                    groupable: groupable !== "false",
                    menu: menu,
                    template: th.attr(kendo.attr("template")),
                    width: cols.eq(idx).css("width")
                };
            });

            encoded = !(that.table.find("tbody tr").length > 0 && (!dataSource || !dataSource.transport));

            that.columns = map(columns, function(column) {
                column = typeof column === STRING ? { field: column } : column;
                if (column.hidden) {
                    column.attributes = addHiddenStyle(column.attributes);
                    column.footerAttributes = addHiddenStyle(column.footerAttributes);
                    column.headerAttributes = addHiddenStyle(column.headerAttributes);
                }

                return extend({ encoded: encoded }, column);
            });
        },

        _groups: function() {
            var group = this.dataSource.group();

            return group ? group.length : 0;
        },

        _tmpl: function(rowTemplate, alt) {
            var that = this,
                settings = extend({}, kendo.Template, that.options.templateSettings),
                idx,
                length = that.columns.length,
                template,
                state = { storage: {}, count: 0 },
                column,
                type,
                hasDetails = that._hasDetails(),
                className = [],
                groups = that._groups();

            if (!rowTemplate) {
                rowTemplate = "<tr";

                if (alt) {
                    className.push("k-alt");
                }

                if (hasDetails) {
                    className.push("k-master-row");
                }

                if (className.length) {
                    rowTemplate += ' class="' + className.join(" ") + '"';
                }

                if (length) { // data item is an object
                    rowTemplate += ' ' + kendo.attr("uid") + '="#=' + settings.paramName + '.uid#"';
                }

                rowTemplate += ">";

                if (groups > 0) {
                    rowTemplate += groupCells(groups);
                }

                if (hasDetails) {
                    rowTemplate += '<td class="k-hierarchy-cell"><a class="k-icon k-plus" href="\\#"></a></td>';
                }

                for (idx = 0; idx < length; idx++) {
                    column = that.columns[idx];
                    template = column.template;
                    type = typeof template;

                    rowTemplate += "<td" + stringifyAttributes(column.attributes) + ">";
                    rowTemplate += that._cellTmpl(column, state);

                    rowTemplate += "</td>";
                }

                rowTemplate += "</tr>";
            }

            rowTemplate = kendo.template(rowTemplate, settings);

            if (state.count > 0) {
                return proxy(rowTemplate, state.storage);
            }

            return rowTemplate;
        },

        _headerCellText: function(column) {
            var that = this,
                settings = extend({}, kendo.Template, that.options.templateSettings),
                template = column.headerTemplate,
                type = typeof(template),
                text = column.title || column.field || "";

            if (type === FUNCTION) {
                text = kendo.template(template, settings)({});
            } else if (type === STRING) {
                text = template;
            }
            return text;
        },

        _cellTmpl: function(column, state) {
            var that = this,
                settings = extend({}, kendo.Template, that.options.templateSettings),
                template = column.template,
                paramName = settings.paramName,
                field = column.field,
                html = "",
                idx,
                length,
                format = column.format,
                type = typeof template,
                columnValues = column.values;

            if (column.command) {
                if (isArray(column.command)) {
                    for (idx = 0, length = column.command.length; idx < length; idx++) {
                        html += that._createButton(column.command[idx]);
                    }
                    return html.replace(templateHashRegExp, "\\#");
                }
                return that._createButton(column.command).replace(templateHashRegExp, "\\#");
            }
            if (type === FUNCTION) {
                state.storage["tmpl" + state.count] = template;
                html += "#=this.tmpl" + state.count + "(" + paramName + ")#";
                state.count ++;
            } else if (type === STRING) {
                html += template;
            } else if (columnValues && columnValues.length && isPlainObject(columnValues[0]) && "value" in columnValues[0]) {
                html += "#var v =" + kendo.stringify(columnValues) + "#";
                html += "#for (var idx=0,length=v.length;idx<length;idx++) {#";
                html += "#if (v[idx].value == ";

                if (!settings.useWithBlock) {
                    html += paramName + ".";
                }

                html += field;
                html += ") { #";
                html += "${v[idx].text}";
                html += "#break;#";
                html += "#}#";
                html += "#}#";
            } else {
                html += column.encoded ? "${" : "#=";

                if (format) {
                    html += 'kendo.format(\"' + format.replace(formatRegExp,"\\$1") + '\",';
                }

                if (field) {
                    field = paramName + "." + field;
                    html += field + "==null?'':" + field;
                } else {
                    html += "''";
                }

                if (format) {
                    html += ")";
                }

                html += column.encoded ? "}" : "#";
            }
            return html;
        },

        _templates: function() {
            var that = this,
                options = that.options,
                dataSource = that.dataSource,
                groups = dataSource.group(),
                aggregates = dataSource.aggregate();

            that.rowTemplate = that._tmpl(options.rowTemplate);
            that.altRowTemplate = that._tmpl(options.altRowTemplate || options.rowTemplate, true);

            if (that._hasDetails()) {
                that.detailTemplate = that._detailTmpl(options.detailTemplate || "");
            }

            if (!isEmptyObject(aggregates) ||
                grep(that.columns, function(column) { return column.footerTemplate; }).length) {

                that.footerTemplate = that._footerTmpl(aggregates, "footerTemplate", "k-footer-template");
            }

            if (groups && grep(that.columns, function(column) { return column.groupFooterTemplate; }).length) {
                aggregates = $.map(groups, function(g) { return g.aggregates; });
                that.groupFooterTemplate = that._footerTmpl(aggregates, "groupFooterTemplate", "k-group-footer");
            }
        },

        _footerTmpl: function(aggregates, templateName, rowClass) {
            var that = this,
                settings = extend({}, kendo.Template, that.options.templateSettings),
                paramName = settings.paramName,
                html = "",
                idx,
                length,
                columns = that.columns,
                template,
                type,
                storage = {},
                count = 0,
                scope = {},
                groups = that._groups(),
                fieldsMap = buildEmptyAggregatesObject(aggregates),
                column;

            html += '<tr class="' + rowClass + '">';

            if (groups > 0) {
                html += groupCells(groups);
            }

            if (that._hasDetails()) {
                html += '<td class="k-hierarchy-cell">&nbsp;</td>';
            }

            for (idx = 0, length = that.columns.length; idx < length; idx++) {
                column = columns[idx];
                template = column[templateName];
                type = typeof template;

                html += "<td" + stringifyAttributes(column.footerAttributes) + ">";

                if (template) {
                    if (type !== FUNCTION) {
                        scope = fieldsMap[column.field] ? extend({}, settings, { paramName: paramName + "." + column.field }) : {};
                        template = kendo.template(template, scope);
                    }

                    storage["tmpl" + count] = template;
                    html += "#=this.tmpl" + count + "(" + paramName + ")#";
                    count ++;
                } else {
                    html += "&nbsp;";
                }

                html += "</td>";
            }

            html += '</tr>';

            html = kendo.template(html, settings);

            if (count > 0) {
                return proxy(html, storage);
            }

            return html;
        },

        _detailTmpl: function(template) {
            var that = this,
                html = "",
                settings = extend({}, kendo.Template, that.options.templateSettings),
                paramName = settings.paramName,
                templateFunctionStorage = {},
                templateFunctionCount = 0,
                groups = that._groups(),
                colspan = visibleColumns(that.columns).length,
                type = typeof template;

            html += '<tr class="k-detail-row">';
            if (groups > 0) {
                html += groupCells(groups);
            }
            html += '<td class="k-hierarchy-cell"></td><td class="k-detail-cell"' + (colspan? ' colspan="' + colspan + '"' : '') + ">";

            if (type === FUNCTION) {
                templateFunctionStorage["tmpl" + templateFunctionCount] = template;
                html += "#=this.tmpl" + templateFunctionCount + "(" + paramName + ")#";
                templateFunctionCount ++;
            } else {
                html += template;
            }

            html += "</td></tr>";

            html = kendo.template(html, settings);

            if (templateFunctionCount > 0) {
                return proxy(html, templateFunctionStorage);
            }

            return html;
        },

        _hasDetails: function() {
            var that = this;

            return that.options.detailTemplate !== null  || (that._events[DETAILINIT] || []).length;
        },

        _details: function() {
            var that = this;

            that.table.on(CLICK + NS, ".k-hierarchy-cell .k-plus, .k-hierarchy-cell .k-minus", function(e) {
                var button = $(this),
                    expanding = button.hasClass("k-plus"),
                    masterRow = button.closest("tr.k-master-row"),
                    detailRow,
                    detailTemplate = that.detailTemplate,
                    data,
                    hasDetails = that._hasDetails();

                button.toggleClass("k-plus", !expanding)
                    .toggleClass("k-minus", expanding);

                if(hasDetails && !masterRow.next().hasClass("k-detail-row")) {
                    data = that.dataItem(masterRow);
                    $(detailTemplate(data))
                        .addClass(masterRow.hasClass("k-alt") ? "k-alt" : "")
                        .insertAfter(masterRow);

                    that.trigger(DETAILINIT, { masterRow: masterRow, detailRow: masterRow.next(), data: data, detailCell: masterRow.next().find(".k-detail-cell") });
                }

                detailRow = masterRow.next();

                that.trigger(expanding ? DETAILEXPAND : DETAILCOLLAPSE, { masterRow: masterRow, detailRow: detailRow});
                detailRow.toggle(expanding);

                e.preventDefault();
                return false;
            });
        },

        dataItem: function(tr) {
            return this._data[this.tbody.find('> tr:not(.k-grouping-row,.k-detail-row,.k-group-footer)').index($(tr))];
        },

        expandRow: function(tr) {
            $(tr).find('> td .k-plus, > td .k-i-expand').click();
        },

        collapseRow: function(tr) {
            $(tr).find('> td .k-minus, > td .k-i-collapse').click();
        },

        _thead: function() {
            var that = this,
                columns = that.columns,
                hasDetails = that._hasDetails() && columns.length,
                idx,
                length,
                html = "",
                thead = that.table.find(">thead"),
                tr,
                text,
                th;

            if (!thead.length) {
                thead = $("<thead/>").insertBefore(that.tbody);
            }

            tr = that.element.find("tr:has(th):first");

            if (!tr.length) {
                tr = thead.children().first();
                if (!tr.length) {
                    tr = $("<tr/>");
                }
            }

            if (!tr.children().length) {
                if (hasDetails) {
                    html += '<th class="k-hierarchy-cell">&nbsp;</th>';
                }

                for (idx = 0, length = columns.length; idx < length; idx++) {
                    th = columns[idx];
                    text = that._headerCellText(th);

                    if (!th.command) {
                        html += "<th " + kendo.attr("field") + "='" + (th.field || "") + "' ";
                        if (th.title) {
                            html += kendo.attr("title") + '="' + th.title.replace(/'/g, "\'") + '" ';
                        }

                        if (th.groupable !== undefined) {
                            html += kendo.attr("groupable") + "='" + th.groupable + "' ";
                        }

                        if (th.aggregates) {
                            html += kendo.attr("aggregates") + "='" + th.aggregates + "'";
                        }

                        html += stringifyAttributes(th.headerAttributes);

                        html += ">" + text + "</th>";
                    } else {
                        html += "<th" + stringifyAttributes(th.headerAttributes) + ">" + text + "</th>";
                    }
                }

                tr.html(html);
            } else if (hasDetails && !tr.find(".k-hierarchy-cell")[0]) {
                tr.prepend('<th class="k-hierarchy-cell">&nbsp;</th>');
            }

            tr.find("th").addClass("k-header");

            if(!that.options.scrollable) {
                thead.addClass("k-grid-header");
            }

            tr.find("script").remove().end().appendTo(thead);

            that.thead = thead;

            that._sortable();

            that._filterable();

            that._scrollable();

            that._updateCols();

            that._resizable();

            that._draggable();

            that._reorderable();

            that._columnMenu();
        },

        _updateCols: function() {
            var that = this;

            that._appendCols(that.thead.parent().add(that.table));
        },

        _appendCols: function(table) {
            var that = this;

            normalizeCols(table, visibleColumns(that.columns), that._hasDetails(), that._groups());
        },

        _autoColumns: function(schema) {
            if (schema && schema.toJSON) {
                var that = this,
                    field;

                schema = schema.toJSON();

                for (field in schema) {
                    that.columns.push({ field: field });
                }

                that._thead();

                that._templates();
            }
        },

        _rowsHtml: function(data) {
            var that = this,
                html = "",
                idx,
                length,
                rowTemplate = that.rowTemplate,
                altRowTemplate = that.altRowTemplate;

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (idx % 2) {
                    html += altRowTemplate(data[idx]);
                } else {
                    html += rowTemplate(data[idx]);
                }

                that._data.push(data[idx]);
            }

            return html;
        },

        _groupRowHtml: function(group, colspan, level) {
            var that = this,
                html = "",
                idx,
                length,
                field = group.field,
                column = grep(that.columns, function(column) { return column.field == field; })[0] || { },
                value = column.format ? kendo.format(column.format, group.value) : group.value,
                template = column.groupHeaderTemplate,
                text =  (column.title || field) + ': ' + value,
                data = extend({}, { field: group.field, value: group.value }, group.aggregates[group.field]),
                groupItems = group.items;

            if (template) {
                text  = typeof template === FUNCTION ? template(data) : kendo.template(template)(data);
            }

            html +=  '<tr class="k-grouping-row">' + groupCells(level) +
                      '<td colspan="' + colspan + '">' +
                        '<p class="k-reset">' +
                         '<a class="k-icon k-i-collapse" href="#"></a>' + text +
                         '</p></td></tr>';

            if(group.hasSubgroups) {
                for(idx = 0, length = groupItems.length; idx < length; idx++) {
                    html += that._groupRowHtml(groupItems[idx], colspan - 1, level + 1);
                }
            } else {
                html += that._rowsHtml(groupItems);
            }

            if (that.groupFooterTemplate) {
                html += that.groupFooterTemplate(group.aggregates);
            }
            return html;
        },

        collapseGroup: function(group) {
            group = $(group).find(".k-icon").addClass("k-i-expand").removeClass("k-i-collapse").end();

            var level = group.find(".k-group-cell").length,
                footerCount = 1,
                offset,
                tr;

            group.nextAll("tr").each(function() {
                tr = $(this);
                offset = tr.find(".k-group-cell").length;

                if (tr.hasClass("k-grouping-row")) {
                    footerCount++;
                } else if (tr.hasClass("k-group-footer")) {
                    footerCount--;
                }

                if (offset <= level || (tr.hasClass("k-group-footer") && footerCount < 0)) {
                    return false;
                }

                tr.hide();
            });
        },

        expandGroup: function(group) {
            group = $(group).find(".k-icon").addClass("k-i-collapse").removeClass("k-i-expand").end();
            var that = this,
                level = group.find(".k-group-cell").length,
                tr,
                offset,
                groupsCount = 1;

            group.nextAll("tr").each(function () {
                tr = $(this);
                offset = tr.find(".k-group-cell").length;
                if (offset <= level) {
                    return false;
                }

                if (offset == level + 1 && !tr.hasClass("k-detail-row")) {
                    tr.show();

                    if (tr.hasClass("k-grouping-row") && tr.find(".k-icon").hasClass("k-i-collapse")) {
                        that.expandGroup(tr);
                    }

                    if (tr.hasClass("k-master-row") && tr.find(".k-icon").hasClass("k-minus")) {
                        tr.next().show();
                    }
                }

                if (tr.hasClass("k-grouping-row")) {
                    groupsCount ++;
                }

                if (tr.hasClass("k-group-footer")) {
                    if (groupsCount == 1) {
                        tr.show();
                    } else {
                        groupsCount --;
                    }
                }
            });
        },

        _updateHeader: function(groups) {
            var that = this,
                cells = that.thead.find("th.k-group-cell"),
                length = cells.length;

            if(groups > length) {
                $(new Array(groups - length + 1).join('<th class="k-group-cell k-header">&nbsp;</th>')).prependTo(that.thead.find("tr"));
            } else if(groups < length) {
                length = length - groups;
                $(grep(cells, function(item, index) { return length > index; } )).remove();
            }
        },

        _firstDataItem: function(data, grouped) {
            if(data && grouped) {
                if(data.hasSubgroups) {
                    data = this._firstDataItem(data.items[0], grouped);
                } else {
                    data = data.items[0];
                }
            }
            return data;
        },

        hideColumn: function(column) {
            var that = this,
                rows,
                row,
                cell,
                idx,
                cols,
                colWidth,
                width = 0,
                length,
                footer = that.footer || that.wrapper.find(".k-grid-footer"),
                columns = that.columns,
                columnIndex;

            if (typeof column == "number") {
                column = columns[column];
            } else {
                column = grep(columns, function(item) {
                    return item.field === column;
                })[0];
            }

            if (!column || column.hidden) {
                return;
            }

            columnIndex = inArray(column, visibleColumns(columns));
            column.hidden = true;
            column.attributes = addHiddenStyle(column.attributes);
            column.footerAttributes = addHiddenStyle(column.footerAttributes);
            column.headerAttributes = addHiddenStyle(column.headerAttributes);
            that._templates();

            that._updateCols();
            that.thead.find(">tr>th:not(.k-hierarchy-cell,.k-group-cell):visible").eq(columnIndex).hide();
            if (footer) {
                that._appendCols(footer.find("table:first"));
                footer.find(".k-footer-template>td:not(.k-hierarchy-cell,.k-group-cell):visible").eq(columnIndex).hide();
            }

            rows = that.tbody.children();
            for (idx = 0, length = rows.length; idx < length; idx += 1) {
                row = rows.eq(idx);
                if (row.is(".k-grouping-row,.k-detail-row")) {
                    cell = row.children(":not(.k-group-cell):first,.k-detail-cell").last();
                    cell.attr("colspan", parseInt(cell.attr("colspan"), 10) - 1);
                } else {
                    if (row.hasClass("k-grid-edit-row") && (cell = row.children(".k-edit-container")[0])) {
                        cell = $(cell);
                        cell.attr("colspan", parseInt(cell.attr("colspan"), 10) - 1);
                        cell.find("col").eq(columnIndex).remove();
                        row = cell.find("tr:first");
                    }

                    row.children(":not(.k-group-cell,.k-hierarchy-cell):visible").eq(columnIndex).hide();
                }
            }

            cols = that.thead.prev().find("col");
            for (idx = 0, length = cols.length; idx < length; idx += 1) {
                colWidth = cols[idx].style.width;
                if (colWidth && colWidth.indexOf("%") == -1) {
                    width += parseInt(colWidth, 10);
                } else {
                    width = 0;
                    break;
                }
            }

            if (width) {
                $(">.k-grid-header table:first,>.k-grid-footer table:first",that.wrapper).add(that.table).width(width);
            }

            that.trigger(COLUMNHIDE, { column: column });
        },

        showColumn: function(column) {
            var that = this,
                rows,
                idx,
                length,
                row,
                cell,
                tables,
                width,
                colWidth,
                cols,
                columns = that.columns,
                footer = that.footer || that.wrapper.find(".k-grid-footer"),
                columnIndex;

            if (typeof column == "number") {
                column = columns[column];
            } else {
                column = grep(columns, function(item) {
                    return item.field === column;
                })[0];
            }

            if (!column || !column.hidden) {
                return;
            }

            columnIndex = inArray(column, columns);
            column.hidden = false;
            column.attributes = removeHiddenStyle(column.attributes);
            column.footerAttributes = removeHiddenStyle(column.footerAttributes);
            column.headerAttributes = removeHiddenStyle(column.headerAttributes);
            that._templates();

            that._updateCols();
            that.thead.find(">tr>th:not(.k-hierarchy-cell,.k-group-cell)").eq(columnIndex).show();
            if (footer) {
                that._appendCols(footer.find("table:first"));
                footer.find(".k-footer-template>td:not(.k-hierarchy-cell,.k-group-cell)").eq(columnIndex).show();
            }

            rows = that.tbody.children();
            for (idx = 0, length = rows.length; idx < length; idx += 1) {
                row = rows.eq(idx);
                if (row.is(".k-grouping-row,.k-detail-row")) {
                    cell = row.children(":not(.k-group-cell):first,.k-detail-cell").last();
                    cell.attr("colspan", parseInt(cell.attr("colspan"), 10) + 1);
                } else {
                    if (row.hasClass("k-grid-edit-row") && (cell = row.children(".k-edit-container")[0])) {
                        cell = $(cell);
                        cell.attr("colspan", parseInt(cell.attr("colspan"), 10) + 1);
                        normalizeCols(cell.find(">form>table"), visibleColumns(columns), false,  0);
                        row = cell.find("tr:first");
                    }

                    row.children(":not(.k-group-cell,.k-hierarchy-cell)").eq(columnIndex).show();
                }
            }

            tables = $(">.k-grid-header table:first,>.k-grid-footer table:first",that.wrapper).add(that.table);
            if (!column.width) {
                tables.width("");
            } else {
                width = 0;
                cols = that.thead.prev().find("col");
                for (idx = 0, length = cols.length; idx < length; idx += 1) {
                    colWidth = cols[idx].style.width;
                    if (colWidth.indexOf("%") > -1) {
                        width = 0;
                        break;
                    }
                    width += parseInt(colWidth, 10);
                }

                if (width) {
                    tables.width(width);
                }
            }

            that.trigger(COLUMNSHOW, { column: column });
        },

        _progress: function(toggle) {
            var that = this,
                element = that.element.is("table") ? that.element.parent() : (that.content && that.content.length ? that.content : that.element);

            kendo.ui.progress(element, toggle);
        },

        refresh: function(e) {
            var that = this,
                length,
                idx,
                html = "",
                data = that.dataSource.view(),
                tbody,
                placeholder,
                currentIndex,
                current = that.current(),
                groups = (that.dataSource.group() || []).length,
                colspan = groups + visibleColumns(that.columns).length;

            if (e && e.action === "itemchange" && that.editable) { // skip rebinding if editing is in progress
                return;
            }

            e = e || {};

            if (that.trigger("dataBinding", { action: e.action || "rebind", index: e.index, items: e.items })) {
                return;
            }

            if (current && current.hasClass("k-state-focused")) {
                currentIndex = that.items().index(current.parent());
            }

            that._destroyEditable();

            that._progress(false);

            that._data = [];

            if (!that.columns.length) {
                that._autoColumns(that._firstDataItem(data[0], groups));
                colspan = groups + that.columns.length;
            }

            that._group = groups > 0 || that._group;

            if(that._group) {
                that._templates();
                that._updateCols();
                that._updateHeader(groups);
                that._group = groups > 0;
            }

            if(groups > 0) {
                if (that.detailTemplate) {
                    colspan++;
                }

                for (idx = 0, length = data.length; idx < length; idx++) {
                    html += that._groupRowHtml(data[idx], colspan, 0);
                }
            } else {
                html += that._rowsHtml(data);
            }

            if (tbodySupportsInnerHtml) {
                that.tbody[0].innerHTML = html;
            } else {
                placeholder = document.createElement("div");
                placeholder.innerHTML = "<table><tbody>" + html + "</tbody></table>";
                tbody = placeholder.firstChild.firstChild;
                that.table[0].replaceChild(tbody, that.tbody[0]);
                that.tbody = $(tbody);
            }

            that._footer();

            that._setContentHeight();

            if (currentIndex >= 0) {
                that.current(that.items().eq(currentIndex).children().filter(DATA_CELL).first());
            }

            that.trigger(DATABOUND);
       }
   });

   function getCommand(commands, name) {
       var idx, length, command;

       if (typeof commands === STRING && commands === name) {
          return commands;
       }

       if (isPlainObject(commands) && commands.name === name) {
           return commands;
       }

       if (isArray(commands)) {
           for (idx = 0, length = commands.length; idx < length; idx++) {
               command = commands[idx];

               if ((typeof command === STRING && command === name) || (command.name === name)) {
                   return command;
               }
           }
       }
       return null;
   }

   ui.plugin(Grid);
   ui.plugin(VirtualScrollable);
})(jQuery);
