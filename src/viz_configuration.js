// Class to manage visualization configuration
class VizConfiguration {
    constructor(document, onDisplayViz, onChangeConfig) {
        let self = this;

        // Set properties
        this.configuration = null;
        this.properties = null;
        this.onDisplayViz = onDisplayViz;
        this.onChangeConfig = onChangeConfig;
    
        // Elements
        this.contentElem = document.querySelector(".content");
        this.vizElem = this.contentElem.querySelector(".visualization");
        this.configElem = this.contentElem.querySelector(".configuration");
        this.validationTextElem = this.configElem.querySelector(".validation");
        this.configTextArea = this.configElem.querySelector("textarea");
        this.noConfigElem = this.contentElem.querySelector(".no-config");
    
        
        // Event handler on configuration icon
        document.querySelector("div.content").ondblclick = function() {
            self.viewConfiguration();
            return false;
        };
    
        // Event handler on validate button
        this.configElem.querySelector("button.validate").onclick = function() {
            let valid = self.validateConfiguration(self.configTextArea.value);
            self.configElem.querySelector("button.save").disabled = !valid;
        };
    
        // Event handler on cancel button
        this.configElem.querySelector("button.cancel").onclick = function() {
            self.configTextArea.value = '';
            self.setDisplayState();
        };
    
        // Event handler on save button
        this.configElem.querySelector("button.save").onclick = function() {
            if(self.onChangeConfig != null)
                onChangeConfig(self.configTextArea.value)
        };
    
        // Set initial display state
        this.setDisplayState();    
    }

    // Set the properties
    setProperties(properties) {
        this.properties = properties;
    }

    // Set the configuration value and update display state
    setConfiguration(configuration) {
        this.configuration = configuration;
        this.setDisplayState();
    }

    // Sets the display state 
    setDisplayState() {
        if(this.configuration == null || this.configuration.length == 0)
        this.viewNoConfiguration();
        else if(this.configuration.length > 0 ) {
            let valid = this.validateConfiguration(this.configuration);
            if(valid == true)
                this.viewVisualization();
            else
                this.viewConfiguration() 
        }
    }

    // Apply properties to a configuration string
    applyProperties(config) {
        if(config == null) return null;
        let thisConfig = config;
        for(let thisDocumentProperty in this.properties) {
            thisConfig = thisConfig.replaceAll(thisDocumentProperty, this.properties[thisDocumentProperty]);
        }
        return thisConfig;
    }

    // Validates the specified configuration for JSON adherence
    validateConfiguration(config) {
        let thisConfig = config;
        if(thisConfig == null)
            thisConfig = '';
        
        // Apply document properties for validation
        thisConfig = this.applyProperties(thisConfig);
        
        try {
            JSON.parse(thisConfig);
            this.validationTextElem.innerHTML = "Valid";
            this.validationTextElem.classList.add('ok');
            this.validationTextElem.classList.remove('error');
            return true;
        }
        catch(err) {
            this.validationTextElem.innerHTML = err.message;
            this.validationTextElem.classList.remove('ok');
            this.validationTextElem.classList.add('error');
            return false;
        }
    }

    // Sets UI to No Configuration
    viewNoConfiguration() {
        this.vizElem.style.display = 'none';
        this.configElem.style.display = 'none';
        this.noConfigElem.style.display = 'flex';
    }

    // Sets UI to Configuration
    viewConfiguration() {
        if(this.configuration != null && this.configuration.length > 0)
            this.configTextArea.value = this.configuration;    
            //this.configTextArea.value = JSON.stringify(JSON.parse(this.configuration), null, ' '); // pretty, but won't work with document properties

        this.validateConfiguration(this.configuration);
        this.configElem.querySelector("button.save").disabled = true;

        this.vizElem.style.display = 'none';
        this.configElem.style.display = 'flex';
        this.noConfigElem.style.display = 'none';
    }

    // Sets UI to Vizualization
    viewVisualization() {
        this.vizElem.style.display = 'flex';
        this.configElem.style.display = 'none';
        this.noConfigElem.style.display = 'none';

        if(this.onDisplayViz != null)
            this.onDisplayViz();
    }
}
