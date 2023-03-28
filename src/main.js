// @ts-nocheck
Spotfire.initialize(async function(mod) {
    // Get the visualization element
    const vizElem = document.querySelector(".visualization"); // Visualization target
    
    // Get the render context
    const context = mod.getRenderContext();



    // --------------------------------------------------------------------------------
    // SPOTFIRE DEFINITIONS
    let rows = null;
    let axes = {};
    let markingEnabled = false;
    let errorMessage = null;

    let modConfigStr = null; // exact copy from config as a string
    let modConfigTemplate = {}; // exact copy from config as an object
    let modConfig = {}; // values passed to mod

    const GRAPHIC_TRANSITION_STOP = 0;
    const GRAPHIC_STOP = 1;
    const GRAPHIC_TRANSITION = 2;

    // --------------------------------------------------------------------------------
    // VIZ DATA AND CONFIG
    let data = [];

    // --------------------------------------------------------------------------------
    // DATA FUNCTIONS
    // Deep clones an object, kind of
    let clone = function(aObject) {
        if (!aObject) {
            return aObject;
        }

        let v;
        let bObject = Array.isArray(aObject) ? [] : {};
        for (const k in aObject) {
        v = aObject[k];
        bObject[k] = (typeof v === "object") ? clone(v) : v;
        }

        return bObject;
    }

    // Format tooltip text
    let formatTooltipText = function(text) {
        return text.replace("<", "").replace(">", "").replace("[", "").replace("]", "");
    }

    // Calculate the delay between two times
    let calcDelay = function(sched, est) {
        if(est == null || sched == null) return null;
        return est.getTime() - sched.getTime();
    }

    // Format a delay
    let formatDelay = function(delay) {
        var one_minute = 60 * 1000;

        if(delay == null) return '';

        var delay = Math.round(delay / one_minute);
        if(isNaN(delay))
        return '';
        else if(delay >= 0)
        return '  +' + delay;
        else if(delay < 0)
        return '  ' + delay;	
    }

    // Sets a delay class based on scheduled and estimated times
    let setDelayClass = function(delay, div) {
        // remove all existing delay classes
        div.classList.remove('early');
        div.classList.remove('ontime');
        div.classList.remove('late');
        
        var one_minute = 60 * 1000;

        if(delay > 0 && Math.abs(delay) > one_minute)
            div.classList.add('late');
        else if(delay < 0 && Math.abs(delay) > one_minute)
            div.classList.add('early');
        else
            div.classList.add('ontime');
    }

    // Formats a date to HH:mm:ss
    let formatDateToTime = function(date) {
        if(date == null) return '';
            
        //let h = new String(date.getHours());
        //let m = new String(date.getMinutes());
        //let s = new String(date.getSeconds());

        // Changed to getUTC due to bug in how times are displayed
        let h = new String(date.getUTCHours());
        let m = new String(date.getUTCMinutes());
        let s = new String(date.getUTCSeconds());
        
        return (h.length == 1 ? '0' : '') + h + ":" + 
            (m.length == 1 ? '0' : '') + m + ":" + 
            (s.length == 1 ? '0' : '') + s;    
    }

    // Test if the specified axis has an expression
    let axisHasExpression = function(name) {
        let axis = axes[name];
        if(axis != null && axis.parts != null && axis.parts.length > 0)
            return true;
        return false;
    }

    // Get the value for a time axis
    let getTimeAxisValue = function(row, name) {
        return axisHasExpression(name) ? row.continuous(name).value() : null
    };

    let translateGraphicType = function(type) {
        if(type === 'line')
            return GRAPHIC_TRANSITION;
        else if(type == 'circle')
            return GRAPHIC_STOP;
        else
            return GRAPHIC_TRANSITION_STOP;
    };

    let getGraphicColor = function(type, stop) {
        if(modConfig.colors == null) return null;
        if(stop.state == null)
            return modConfig.colors.pending;
        let isCombined = stop.graphicType == null || stop.graphicType == GRAPHIC_TRANSITION_STOP;
        if(stop.state == "active" && isCombined && type == GRAPHIC_TRANSITION)
            return modConfig.colors.done;
        if(stop.state == "next" && isCombined && type == GRAPHIC_STOP)
            return modConfig.colors.pending;
        return modConfig.colors[stop.state];
    };

    // Set marking enabled
    let setMarkingEnabled = function(enabled) {
        markingEnabled = enabled;
    }

    // --------------------------------------------------------------------------------
    // ViZ FUNCTIONS
    // Converts data rows into objects
    let processRows = async function() {
        if(rows == null) return false;

        // Reset arrays
        data = [];

        // Test for row count
        let stopLimit = modConfig.stopLimit ? modConfig.stopLimit : 10;
        let rowCount = rows.length;
        if(rowCount > stopLimit) {
            //mod.controls.errorOverlay.show("Cannot render - too many rows (rowCount: ".concat(rowCount, ", limit: ").concat(stopLimit, ") "), "rowCount");
            errorMessage = "Cannot render - too many rows (rowCount: ".concat(rowCount, ", limit: ").concat(stopLimit, ") ");
            return;
        }
        else
            errorMessage = null;     

        // Iterate over rows and push into arrays
        rows.forEach(function(row) {
            let stop = {
                stopSequence: axisHasExpression("Sequence by") ? row.continuous("Sequence by").value() : 0,
                stopName: row.categorical("Name").formattedValue(),
                graphicType: axisHasExpression("Graphic type") ? translateGraphicType(row.categorical("Graphic type").formattedValue()) : null,
                schedArr: getTimeAxisValue(row, "Sched Arr"),
                schedDep: getTimeAxisValue(row, "Sched Dep"),
                estArr: getTimeAxisValue(row, "Est Arr"),
                estDep: getTimeAxisValue(row, "Est Dep"),
                actArr: getTimeAxisValue(row, "Act Arr"),
                actDep: getTimeAxisValue(row, "Act Dep"),
                state: axisHasExpression("Status") ? row.categorical("Status").formattedValue() : null,
                marked: row.isMarked(),
                row: row
            }

            data.push(stop);
        });

        // Sort by stopSequence
        let sortProp = 'stopSequence';
        data.sort(function(a, b){return a[sortProp] - b[sortProp]});
    }

    // Draws the visualization
    let drawViz = async function() {
        vizElem.innerHTML = '';

        // If there is already an error message
        if(errorMessage != null) {
            displayError();
        }
        // If there is no data then display no data message
        else if(data.length == 0) {
            errorMessage = "No stop data found";
            displayError();
        }
        else {
            // Create the graphic container, append later
            let graphicContainer = document.createElement("div");
            graphicContainer.classList.add("trip-stop-graphic");
    
            // Iterate over the data list and draw graphics
            for(let idx = 0; idx < data.length; idx++) {
                drawGraphic(data[idx], graphicContainer, idx, idx == data.length - 1);
            }
    
            // Create the text container, append later
            let textContainer = document.createElement("div");
            textContainer.classList.add("trip-stop-text");
    
            // Iterate over the data list and draw text
            for(let idx = 0; idx < data.length; idx++) {
                if(data[idx].graphicType != GRAPHIC_TRANSITION)
                    drawText(data[idx], textContainer);
            }

            // Append graphic and text containers -- do it later to help performance
            vizElem.appendChild(graphicContainer);
            vizElem.appendChild(textContainer);
        }
    }

    // Draw error message
    let displayError = function() {
        let errorElem = document.createElement("div");
        errorElem.classList.add("mod-error");
        errorElem.appendChild(document.createTextNode(errorMessage));
        vizElem.appendChild(errorElem);
    }

    let drawGraphic = function(stop, container, index) {
        if(stop.graphicType == GRAPHIC_STOP)  {
            let stopElem = drawGraphicStop(stop);
            container.appendChild(stopElem);
        }
        else if(stop.graphicType == GRAPHIC_TRANSITION) {
            let transitionElem = drawGraphicTransition(stop);
            container.appendChild(transitionElem);
        }
        else {
            if(index > 0) {
                let transitionElem = drawGraphicTransition(stop);
                container.appendChild(transitionElem);
            }
            let stopElem = drawGraphicStop(stop);
            container.appendChild(stopElem);
        }
    };

    let drawGraphicStop = function(stop) {
        let stopElem = document.createElement("div");
        stopElem.classList.add("stop");

        let svgElem = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        stopElem.appendChild(svgElem);

        let circleElem = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circleElem.style.stroke = getGraphicColor(GRAPHIC_STOP, stop);
        svgElem.appendChild(circleElem);

        return stopElem;
    };

    let drawGraphicTransition = function(stop) {
        let transitionElem = document.createElement("div");
        transitionElem.classList.add("transition");

        let svgElem = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        transitionElem.appendChild(svgElem);

        let rectElem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rectElem.style.stroke = getGraphicColor(GRAPHIC_TRANSITION, stop);
        rectElem.style.fill = getGraphicColor(GRAPHIC_TRANSITION, stop);
        svgElem.appendChild(rectElem);

        return transitionElem;
    };

    let drawText = function(stop, container) {
        // Create stop element
        let stopElem = document.createElement("div");
        stopElem.classList.add("stop");
        if(stop.marked == true)
            stopElem.classList.add("marked");
        else if(markingEnabled != null && markingEnabled != false)
            stopElem.classList.add("markable");
        container.appendChild(stopElem);

        if(markingEnabled != null) {
            stopElem.onclick = function() {
                if(window.event.ctrlKey == true)
                    stop.row.mark("Toggle");
                else
                    stop.row.mark("Replace");
            };
        }

        // Create stop name element        
        let nameElem = document.createElement("div");
        nameElem.classList.add("name");
        stopElem.appendChild(nameElem);
        nameElem.appendChild(document.createTextNode(stop.stopName));
        if(stop.marked == true) {
            nameElem.style.backgroundColor = markingEnabled.colorHexCode;
        }

        // Create times element
        let timesElem = document.createElement("div");
        timesElem.classList.add("times");
        stopElem.appendChild(timesElem);

        // Create scheduled time
        let schedTime = drawTextTime("scheduled", formatDateToTime(stop.schedArr), null, formatDateToTime(stop.schedDep), null);
        timesElem.appendChild(schedTime);

        // Create estimated time
        let estTime = drawTextTime("estimated", formatDateToTime(stop.estArr), calcDelay(stop.schedArr, stop.estArr), formatDateToTime(stop.estDep), calcDelay(stop.schedDep, stop.estDep));
        timesElem.appendChild(estTime);

        // Create actual time
        let actTime = drawTextTime("actual", formatDateToTime(stop.actArr), calcDelay(stop.schedArr, stop.actArr), formatDateToTime(stop.actDep), calcDelay(stop.schedDep, stop.actDep));
        timesElem.appendChild(actTime);
    };

    let drawTextTime = function(type, arrival, arrivalDelta, departure, departureDelta) {
        let timeElem = document.createElement("div");
        timeElem.classList.add("time");
        timeElem.classList.add(type);

        let arrElem = document.createElement("div");
        arrElem.classList.add("value");
        arrElem.appendChild(document.createTextNode(arrival));
        timeElem.appendChild(arrElem);

        let arrDeltaElem = document.createElement("div");
        arrDeltaElem.classList.add("delta");
        timeElem.appendChild(arrDeltaElem);

        if((type == "estimated" && (modConfig.delays == null || modConfig.delays.calcEstArrDelay != false)) || 
                (type == "actual" && (modConfig.delays == null || modConfig.delays.calcActArrDelay != false))) { 
            setDelayClass(arrivalDelta, arrDeltaElem);
            arrDeltaElem.appendChild(document.createTextNode(arrivalDelta == null ? '' : formatDelay(arrivalDelta)));
        }

        let depElem = document.createElement("div");
        depElem.classList.add("value");
        depElem.appendChild(document.createTextNode(departure));
        timeElem.appendChild(depElem);
        
        let depDeltaElem = document.createElement("div");
        depDeltaElem.classList.add("delta");
        timeElem.appendChild(depDeltaElem);

        if((type == "estimated" && (modConfig.delays == null || modConfig.delays.calcEstDepDelay != false)) 
                || (type == "actual" && (modConfig.delays == null || modConfig.delays.calcActDepDelay != false))) { 
            setDelayClass(departureDelta, depDeltaElem);
            depDeltaElem.appendChild(document.createTextNode(departureDelta == null ? '' : formatDelay(departureDelta)));
        }

        return timeElem;
    };


    // --------------------------------------------------------------------------------
    // DOCUMENT PROPERTIES
    // Convert document properties to an object
    let convertDocumentProperties = function(documentProperties) {
        let properties = {};
        for(let thisDocumentProperty of documentProperties) {
            if(thisDocumentProperty.isList == false) {
                properties["%%" + thisDocumentProperty.name + "%%"] = thisDocumentProperty.value();
            }
        }
        return properties;
    };

    // --------------------------------------------------------------------------------
    // CONFIGURATION
    // Updates the configuration in the property store, this will trigger a redraw
    let updateConfig = function(config) {
        mod.property("mod-config").set(config);
    }

    // Process configuration settings
    let processConfiguration = async function(documentProperties) {
        let properties = convertDocumentProperties(documentProperties); 
        vizConfiguration.setProperties(properties); 

        // If there is a configuration string, then process as JSON
        if(modConfigStr != null && modConfigStr.length > 0)  {
            // Apply document properties
            let updatedConfigStr = vizConfiguration.applyProperties(modConfigStr);

            // This is the exact configuration from the config panel, with doc props substituted
            modConfigTemplate = JSON.parse(updatedConfigStr);

            // This is the configuration that will be used internally in any libraries
            modConfig = clone(modConfigTemplate);

            // Setup marking enabled based on dataView property
            setMarkingEnabled(false);

            // Reset the data
            data = [];
            traces = {};

            // Reprocess the rows and draw the chart with updated configuration
            await processRows();
            await drawViz();
        }
    }


    // Get the configuration handler
    //   document - the HTML document
    //   drawViz - function to call when toggling to visualization mode, this
    //     will redraw the viz due to changes in div sizing
    //   updateConfig - function to call when dialog saves the configuration
    const vizConfiguration = new VizConfiguration(document, drawViz, updateConfig);
    


    // --------------------------------------------------------------------------------
    // DATA EVENT HANDLER
    // Create a read function for data changes
    let readData = mod.createReader(
        mod.visualization.axis("Sequence by"),
        mod.visualization.axis("Name"),
        mod.visualization.axis("Graphic type"),
        mod.visualization.axis("Sched Arr"),
        mod.visualization.axis("Sched Dep"),
        mod.visualization.axis("Est Arr"),
        mod.visualization.axis("Est Dep"),
        mod.visualization.axis("Act Arr"),
        mod.visualization.axis("Act Dep"),
        mod.visualization.axis("Status"),
        mod.visualization.data(),
        mod.windowSize()
    );

    // Subscribe to data changes
    readData.subscribe(async function onChange(orderByView, nameView, graphicTypeView, schedArrView, schedDepView, estArrView, estDepView, actArrView, actDepView, statusView, dataView, windowSizeView) {
        let axesArr = [orderByView, nameView, graphicTypeView, schedArrView, schedDepView, estArrView, estDepView, actArrView, actDepView, statusView];
        for(let thisAxis of axesArr) {
            axes[thisAxis.name] = thisAxis;
        }

        // Test data view for errors
        let errors = await dataView.getErrors();
        if(errors.length > 0) {
            mod.controls.errorOverlay.show(errors);
            return;
        }
        else {
            mod.controls.errorOverlay.hide();
        }

        // Set marking enabled flag
        let markingEnabledView = await dataView.marking();
        if(markingEnabled != markingEnabledView) {
            markingEnabled = markingEnabledView;
        }

        // Get all rows and process
        rows = await dataView.allRows();    
      
        // Process rows to objects
        await processRows();

        // Draw viz
        await drawViz();

        // Complete render
        context.signalRenderComplete();
    });

    // Create a read function for document properties
    let readDocumentProperties = mod.createReader(
        mod.document.properties()
    );
    
    // Call the read function to schedule an onChange callback (one time)
    readDocumentProperties.subscribe(async function onChange(documentProperties) {
        await processConfiguration(documentProperties);
    });


    // Create a read function for mod-config
    let readModConfig = mod.createReader(
        mod.property("mod-config")
    );
    
    // Call the read function to schedule an onChange callback (one time)
    readModConfig.subscribe(async function onChange(config) {
        modConfigStr = config.value();

        // Update the configuration in the configuration handler
        vizConfiguration.setConfiguration(modConfigStr);
        
        // Process the configuration
        let documentProperties = await mod.document.properties();
        await processConfiguration(documentProperties);

        // Complete render
        // context.signalRenderComplete();
    });

}); // end Spotfire
