/*!
 * RVL.js v1.0
 * (c) 2018 Rares Portan
 * Released under the MIT License.
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ?
        module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) : (global.RVL = factory());
}(this, (function () {
    'use strict';

    const config = {
        // The "normal" size of the presentation, aspect ratio will be preserved
        // when the presentation is scaled to fit different resolutions
        width: 960,
        height: 700,
        margin: 0.04, // Factor of the display size that should remain empty around the content

        // Bounds for smallest/largest possible scale to apply to content
        minScale: 0.2,
        maxScale: 2.0,

        controls: true, // Display presentation control arrows
        controlsLayout: 'bottom-right', // Determines where controls appear, "edges" or "bottom-right"
        progress: true, // Display a presentation progress bar
        slideNumber: true, // Display the page number of the current slide
        fragments: true, // Turns fragments on and off globally
        transition: 'slide', // Transition style: none/fade/slide/convex/concave/zoom
        transitionSpeed: 'default', //  Transition speed: default/fast/slow
        backgroundTransition: 'fade', // Transition style for full page slide backgrounds: none/fade/slide/convex/concave/zoom        
        viewDistance: 3, // Number of slides away from the current that are visible        
        display: 'block', // The display mode that will be used to show slides
    };

    const state = {
        activeSlideIndex: undefined, // The index of the currently active slide        
        currentSlide: undefined, // The current slide HTML element
        previousBackground: undefined,
        dom: {} // Cached references to DOM elements
    }



    /////////////////////////////////////////////////

    const extend = (a, b) => Object.assign(a, b);
    const toArray = (o) => Array.prototype.slice.call(o);

    const isNumber = x => typeof x === 'number';
    const isString = x => typeof x === 'string';

    const addClass = (node) => className => node.classList.add(className);
    const removeClass = (node) => className => node.classList.remove(className);

    const addAttribute = (node) => (attrName, attrValue) => node.setAttribute(attrName, attrValue);
    const removeAttribute = (node) => (attrName) => node.removeAttribute(attrName);
    const getAttribute = (node) => (attrName) => node.getAttribute(attrName);

    const style = (node) => (styleName, styleValue) => node.style[styleName] = styleValue;


    // Enable a HTML element
    const disable = (node) => {
        removeClass(node)('enabled');
        addAttribute(node)('disabled', 'disabled');
        return node;
    }

    // Disable a HTML element
    const enable = (node) => {
        addClass(node)('enabled');
        removeAttribute(node)('disabled');
        return node;
    }

    // Show HTML element
    const show = (node) => {
        style(node)('display', 'block')
        return node;
    }

    // Hide HTML element
    const hide = (node) => {
        style(node)('display', 'none')
        return node;
    }

    // Center HTML element
    const center = (node) => {
        addClass(node)('center');
        return node;
    }

    const disallowTransitions = (node) => {
        addClass(node)('no-transition');
        return node;
    }

    const allowTransitions = (node) => {
        removeClass(node)('no-transition');
        return node;
    }

    const markAsHidden = (node) => {
        const attrSetter = addAttribute(node);
        attrSetter('hidden', '');
        attrSetter('aria-hidden', 'true');
    }

    const unmarkAsHidden = (node) => {
        const attrRemover = removeAttribute(node);
        attrRemover('hidden');
        attrRemover('aria-hidden');
    }

    const createNode = (tagname, classname, innerHTML) => {
        const node = document.createElement(tagname);
        node.className = classname;

        if (isString(innerHTML)) {
            node.innerHTML = innerHTML;
        }
        return node;
    }


    // Finds a child HTML element and returns a reference to it.
    const findNode = (node, selector) => {
        return node.querySelector(selector);
    }



    /////////////////////////////////////////////



    function initialize(options) {
        console.log('initialize', options);

        // Cache references to key DOM elements
        const wrapper = document.querySelector('.reveal');
        const slidesContainer = document.querySelector('.reveal .slides');
        const slides = toArray(slidesContainer.querySelectorAll('section'));
        const fragments = toArray(slidesContainer.querySelectorAll('.fragment'));

        // Force a layout when the whole page, incl fonts, has loaded
        window.addEventListener('load', layout, false);

        // Copy options over to our config object
        extend(config, options);

        // Prevent transitions while we're loading
        disallowTransitions(slidesContainer);

        // Make sure we've got all the DOM elements we need
        const dom = setupDOM();

        wrapper.appendChild(dom.background);
        wrapper.appendChild(dom.progress);
        wrapper.appendChild(dom.controls);
        wrapper.appendChild(dom.slideNumber);

        addAttribute(wrapper)('role', 'application');

        state.dom = extend(dom, { wrapper, slidesContainer, slides, fragments })

        // Updates the presentation to match the current configuration values
        configure(config, state.dom);

        // Read the initial hash
        readURL();

        // Enable transitions now that we're loaded
        allowTransitions(slidesContainer);

        addClass(wrapper)('ready')
    }


    /**
	 * Creates references to DOM elements which are
	 * required by the presentation. 
	 */
    function setupDOM() {
        console.log('setupDOM');

        const dom = {};

        // Background element
        dom.background = createNode('div', 'backgrounds');

        // Progress bar
        dom.progress = createNode('div', 'progress', '<span></span>');
        dom.progressbar = findNode(dom.progress, 'span');

        // Arrow controls
        dom.controls = createNode('aside', 'controls',
            '<button class="navigate-left" aria-label="previous slide"><div class="controls-arrow"></div></button>' +
            '<button class="navigate-right" aria-label="next slide"><div class="controls-arrow"></div></button>');

        // Slide number
        dom.slideNumber = createNode('div', 'slide-number', '');

        // There can be multiple instances of controls throughout the page
        dom.controlsPrev = findNode(dom.controls, '.navigate-left');
        dom.controlsNext = findNode(dom.controls, '.navigate-right');

        return dom;
    }


    /**
	 * Applies the configuration settings from the config
	 */
    function configure(config, dom) {
        const wrapper = dom.wrapper;

        addClass(wrapper)(config.transition);
        center(wrapper);
        addAttribute(wrapper)('data-transition-speed', config.transitionSpeed);
        addAttribute(wrapper)('data-background-transition', config.backgroundTransition);

        config.controls ? show(dom.controls) : hide(dom.controls);
        config.progress ? show(dom.progress) : hide(dom.progress);

        addAttribute(dom.controls)('data-controls-layout', config.controlsLayout);

        // When fragments are turned off they should be visible
        if (!config.fragments) {
            dom.fragments.forEach((element) => {
                addClass(element)('visible');
            });
        }

        // Slide numbers
        config.slideNumber ? show(dom.slideNumber) : hide(dom.slideNumber);

        // Subscribe to input        
        addEventListeners(dom);

        // Force a layout to make sure the current config is accounted for
        layout(dom, config);

        // Create the slides backgrounds
        createBackgrounds(dom.slides, dom.background);
    }


    /**
	 * Steps from the current point in the presentation to the
	 * slide which matches the specified horizontal and vertical
	 * indices.
	 *
	 * @param {number} [slideIndex] Horizontal index of the target slide
	 * @param {number} [fragmentIndex] Index of a fragment within the
	 * target slide to activate
	 */
    function slide(slideIndex, fragmentIndex) {
        const slides = state.dom.slides;

        // Abort if there are no slides
        if (slides.length === 0) return;

        // Remember where we were at before
        const previousSlide = state.currentSlide;
        const previousIndex = state.activeSlideIndex || 0;

        // Activate and transition to the new slide
        state.activeSlideIndex = updateSlides(slideIndex === undefined ? state.activeSlideIndex : slideIndex);

        // Update the visibility of slides now that the indices have changed
        updateSlidesVisibility();

        layout(state.dom, config);

        // Store references to the current slides
        state.currentSlide = slides[state.activeSlideIndex];

        // Show fragment, if specified
        if (typeof fragmentIndex !== 'undefined') {
            navigateFragment(fragmentIndex);
        }

        const slideChanged = (state.activeSlideIndex !== previousIndex);
        // Handle embedded content
        if (slideChanged) {
            stopEmbeddedContent(previousSlide);
            startEmbeddedContent(state.currentSlide);
        }

        updateControls();
        updateProgress();
        updateBackground();
        updateSlideNumber();

        // Update the URL hash
        writeURL();
    }


    function markSlideAsPast(slide, fragmentAreEnabled) {
        addClass(slide)('past');

        if (fragmentAreEnabled) {
            const pastFragments = toArray(slide.querySelectorAll('.fragment'));
            // Show all fragments on past slides
            pastFragments.forEach(aFragment => {
                addClass(aFragment)('visible');
            })
        }
    }

    function markSlideAsFuture(slide, fragmentAreEnabled) {
        addClass(slide)('future');

        if (fragmentAreEnabled) {
            const pastFragments = toArray(slide.querySelectorAll('.fragment'));
            // Hide all fragments on future slides
            pastFragments.forEach(aFragment => {
                removeClass(aFragment)('visible');
            })
        }
    }

    /**
	 * Updates one dimension of slides by showing the slide
	 * with the specified index.
	 *
	 * @param {number} index The index of the slide that should be shown
	 *
	 * @return {number} The index of the slide that is now shown,
	 * might differ from the passed in index if it was out of
	 * bounds.
	 */
    function updateSlides(index) {
        var slides = state.dom.slides,
            slidesLength = slides.length;

        if (slidesLength < 1) return 0;

        // Enforce max and minimum index bounds
        index = Math.max(Math.min(index, slidesLength - 1), 0);

        slides.forEach((aSlide, i) => {
            const classRemover = removeClass(aSlide);
            classRemover('past');
            classRemover('present');
            classRemover('future');

            markAsHidden(aSlide);

            if (i < index) {
                markSlideAsPast(aSlide, config.fragments);
            }
            else if (i > index) {
                markSlideAsFuture(aSlide, config.fragments);
            }
        })

        // Mark the current slide as present
        addClass(slides[index])('present')
        unmarkAsHidden(slides[index]);

        return index;
    }


    /**
	 * Updates the background elements to reflect the current slide.
	 */
    function updateBackground() {
        let currentBackground = null;
        const slideIndex = state.activeSlideIndex;

        // Update the classes of all backgrounds to match the states of their slides
        const allBackgrounds = toArray(state.dom.background.childNodes);
        allBackgrounds.forEach(function (background, index) {
            const addClassToBg = addClass(background);
            const removeClassFromBg = removeClass(background);

            removeClassFromBg('past');
            removeClassFromBg('present');
            removeClassFromBg('future');

            if (index < slideIndex) {
                addClassToBg('past');
            }
            else if (index > slideIndex) {
                addClassToBg('future');
            }
            else {
                addClassToBg('present');
                currentBackground = background;
            }
        });

        // Stop content inside of previous backgrounds
        if (state.previousBackground) {
            stopEmbeddedContent(state.previousBackground);
        }

        // Start content in the current background
        if (currentBackground) {
            startEmbeddedContent(currentBackground);

            const currentBackgroundContent = currentBackground.querySelector('.slide-background-content');
            if (currentBackgroundContent) {
                const backgroundImageURL = currentBackgroundContent.style.backgroundImage || '';

                // Restart GIFs (doesn't work in Firefox)
                if (/\.gif/i.test(backgroundImageURL)) {
                    currentBackgroundContent.style.backgroundImage = '';
                    window.getComputedStyle(currentBackgroundContent).opacity;
                    currentBackgroundContent.style.backgroundImage = backgroundImageURL;
                }
            }

            // Don't transition between identical backgrounds. This prevents unwanted flicker.
            const previousBackgroundHash = state.previousBackground ? state.previousBackground.getAttribute('data-background-hash') : null;
            const currentBackgroundHash = currentBackground.getAttribute('data-background-hash');
            if (currentBackgroundHash && currentBackgroundHash === previousBackgroundHash && currentBackground !== state.previousBackground) {
                state.dom.background.classList.add('no-transition');
                disallowTransitions(state.dom.background);
            }
            state.previousBackground = currentBackground;
        }

        // Allow the first background to apply without transition
        setTimeout(() => {
            allowTransitions(state.dom.background)
        }, 1);
    }


    /**
	 * Applies JavaScript-controlled layout rules to the presentation.
	 */
    function layout(dom, config) {
        console.log('layout');

        const wrapper = dom.wrapper;
        if (!wrapper || config.disableLayout) return;

        const slidesContainer = dom.slidesContainer;
        const size = computeSlideSize(config, wrapper.offsetWidth, wrapper.offsetHeight);

        // Determine scale of content to fit within available space
        let scale = Math.min(size.presentationWidth / size.width, size.presentationHeight / size.height);
        // Respect max/min scale settings
        scale = Math.max(scale, config.minScale);
        scale = Math.min(scale, config.maxScale);

        // Layout the contents of the slides
        layoutStrechedSlides(config.width, config.height);

        const styleSlidesContainer = style(slidesContainer);
        styleSlidesContainer('width', size.width + 'px');
        styleSlidesContainer('height', size.height + 'px');
        styleSlidesContainer('zoom', scale > 1 ? scale : '');
        styleSlidesContainer('left', scale < 1 ? '50%' : '');
        styleSlidesContainer('top', scale < 1 ? '50%' : '');
        styleSlidesContainer('bottom', scale < 1 ? 'auto' : '');
        styleSlidesContainer('right', scale < 1 ? 'auto' : '');
        styleSlidesContainer('transform', scale < 1 ? 'translate(-50%, -50%) scale(' + scale + ')' : '');

        updateProgress();
    }


    /**
     * Calculates the computed pixel size of our slides. These
     * values are based on the width and height configuration options.	
     */
    function computeSlideSize(config, presentationWidth, presentationHeight) {
        const size = {
            // Slide size
            width: config.width,
            height: config.height,
            // Presentation size
            presentationWidth: presentationWidth - presentationWidth * config.margin,
            presentationHeight: presentationHeight - presentationHeight * config.margin,
        };

        // Slide width or height may be a percentage
        if (typeof size.width === 'string' && /%$/.test(size.width)) {
            size.width = parseInt(size.width, 10) / 100 * size.presentationWidth;
        }
        if (typeof size.height === 'string' && /%$/.test(size.height)) {
            size.height = parseInt(size.height, 10) / 100 * size.presentationHeight;
        }
        return size;
    }


	/**
	 * Applies layout logic to the contents of all slides in the presentation.
	 */
    function layoutStrechedSlides(width, height) {
        const strechedNodes = toArray(state.dom.slidesContainer.querySelectorAll('section > .stretch'));
        strechedNodes.forEach((element) => {
            // Determine how much vertical space we can use
            const remainingHeight = getRemainingHeight(element, height);
            const styler = style(element);

            // Respect the aspect ratio of media elements
            if (/(img|video)/gi.test(element.nodeName)) {
                const unscaledWidth = element.naturalWidth || element.videoWidth;
                const unscaledHeight = element.naturalHeight || element.videoHeight;
                const scale = Math.min(width / unscaledWidth, remainingHeight / unscaledHeight);

                styler('width', (unscaledWidth * scale) + 'px');
                styler('height', (unscaledHeight * scale) + 'px');
            }
            else {
                styler('width', width + 'px');
                styler('height', remainingHeight + 'px');
            }
        });
    }


    /**
	 * Returns the remaining height within the parent of the target element.
	 * remaining height = [ configured parent height ] - [ current parent height ]
	 */
    function getRemainingHeight(element, height) {
        height = height || 0;
        if (element) {
            let newHeight, oldHeight = element.style.height;

            // Change the .stretch element height to 0 in order find the height of all
            // the other elements
            element.style.height = '0px';
            newHeight = height - element.parentNode.offsetHeight;

            // Restore the old height, just in case
            element.style.height = oldHeight + 'px';
            return newHeight;
        }
        return height;
    }


    /**
	 * Creates the slide background elements and appends them
	 * to the background container. One element is created per
	 * slide no matter if the given slide has visible background.
	 */
    function createBackgrounds(slides, backgroundContainer) {
        backgroundContainer.innerHTML = '';
        disallowTransitions(backgroundContainer);

        // Iterate over all slides and create a background element for each
        slides.forEach(slide => {
            const bg = createNode('div', 'slide-background', '<div class="slide-background-content"></div>');
            backgroundContainer.appendChild(bg);

            slide.slideBackgroundElement = bg;
            slide.slideBackgroundContentElement = bg.querySelector('.slide-background-content');
            // Syncs the background to reflect all current background settings
            syncBackground(slide);
        });

        allowTransitions(backgroundContainer);
    }


	/**
	 * Renders all of the visual properties of a slide background
	 * based on the various background attributes.
	 *
	 * @param {HTMLElement} slide
	 */
    function syncBackground(slide) {
        var element = slide.slideBackgroundElement,
            contentElement = slide.slideBackgroundContentElement;

        const getSlideAttr = getAttribute(slide);
        var data = {
            background: getSlideAttr('data-background'),
            backgroundSize: getSlideAttr('data-background-size'),
            backgroundImage: getSlideAttr('data-background-image'),
            backgroundVideo: getSlideAttr('data-background-video'),
            backgroundColor: getSlideAttr('data-background-color'),
            backgroundRepeat: getSlideAttr('data-background-repeat'),
            backgroundPosition: getSlideAttr('data-background-position'),
            backgroundTransition: getSlideAttr('data-background-transition'),
            backgroundOpacity: getSlideAttr('data-background-opacity'),
            backgroundBrightness: getSlideAttr('data-background-brightness')
        };

        if (data.background) {
            // Auto-wrap image urls in url(...)
            if (/^(http|file|\/\/)/gi.test(data.background) || /\.(svg|png|jpg|jpeg|gif|bmp)([?#\s]|$)/gi.test(data.background)) {
                addAttribute(slide)('data-background-image', data.background);
            }
            else {
                style(element)('background', data.background)
            }
        }

        // Create a hash for this combination of background settings.
        // This is used to determine when two slide backgrounds are the same.
        addAttribute(element)('data-background-hash', Object.keys(data).reduce((result, key) => result += data[key] || '', ''));

        // Additional and optional background properties
        if (data.backgroundSize) addAttribute(element)('data-background-size', data.backgroundSize);
        if (data.backgroundColor) style(element)('backgroundColor', data.backgroundColor);
        if (data.backgroundTransition) addAttribute(element)('data-background-transition', data.backgroundTransition);

        // Background image options are set on the content wrapper
        const styleContentElement = style(contentElement);
        if (data.backgroundSize) styleContentElement('backgroundSize', data.backgroundSize);
        if (data.backgroundRepeat) styleContentElement('backgroundRepeat', data.backgroundRepeat);
        if (data.backgroundPosition) styleContentElement('backgroundPosition', data.backgroundPosition);
        if (data.backgroundOpacity) styleContentElement('opacity', data.backgroundOpacity);

        // If this slide has a background brightness, add a class that signals if it is light or dark. 
        if (data.backgroundBrightness === 'dark') addClass(slide)('has-dark-background');
        else if (data.backgroundBrightness === 'light') addClass(slide)('has-light-background');
    }


    /**
     * Updates the progress bar to reflect the current slide.
     */
    function updateProgress() {
        // Update progress if enabled
        const progressbar = state.dom.progressbar;
        if (config.progress && progressbar) {
            const wrapper = state.dom.wrapper;
            const totalCount = state.dom.slides.length;
            const pastCount = state.activeSlideIndex;
            const progress = pastCount / (totalCount - 1);

            style(progressbar)('width', progress * wrapper.offsetWidth + 'px')
        }
    }


    /**
	 * Returns an object describing the available fragment directions.
	 *
	 * @return {{prev: boolean, next: boolean}}
	 */
    function availableFragments() {
        const currentSlide = state.currentSlide;
        const useFragments = config.fragments;
        const fragments = useFragments && currentSlide && currentSlide.querySelectorAll('.fragment');
        const hiddenFragments = useFragments && currentSlide && currentSlide.querySelectorAll('.fragment:not(.visible)');

        return {
            prev: fragments && hiddenFragments && (fragments.length - hiddenFragments.length > 0),
            next: hiddenFragments && !!hiddenFragments.length
        };
    }


    /**
	 * Determine what available routes there are for navigation.
	 *
	 * @return {{left: boolean, right: boolean}}
	 */
    function availableRoutes() {
        const fragmentRoutes = availableFragments();
        return {
            left: state.activeSlideIndex > 0 || fragmentRoutes.prev,
            right: state.activeSlideIndex < state.dom.slides.length - 1 || fragmentRoutes.next,
        };
    }


    /**
	 * Reads the current URL (hash) and navigates accordingly.
	 */
    function readURL() {
        const hash = window.location.hash; // e.g. #/7/1
        const bits = hash.slice(2).split('/');
        const slideIndex = (parseInt(bits[0], 10) - 1) || 0;
        const fragmentIndex = parseInt(bits[1], 10) || undefined;

        if (slideIndex !== state.activeSlideIndex || fragmentIndex !== undefined) {
            slide(slideIndex, fragmentIndex);
        }
    }


    /**
	 * Updates the page URL (hash) to reflect the current state.
	 */
    function writeURL() {
        const currentSlide = state.currentSlide;
        if (currentSlide) {
            const activeSlideIndex = state.activeSlideIndex || 0;
            const fragmentIndex = currentSlide.querySelectorAll('.fragment.visible').length - 1;

            let url = '/';
            if (activeSlideIndex > 0 || fragmentIndex !== -1) url += activeSlideIndex + 1;
            if (fragmentIndex !== -1) url += '/' + fragmentIndex;

            window.location.hash = url;
        }
    }


    /**
     * Called when the given slide is within the configured view
     * distance. Shows the slide element and loads any content
     * that is set to load lazily (data-src).
     *
     * @param {HTMLElement} slide Slide to show
     */
    function loadSlide(slide, options) {
        options = options || {};

        // Show the slide element
        style(slide)('display', config.display)

        const lazyLoadedMediaSelector = ['img[data-src]',
            'video[data-src]',
            'audio[data-src]',
            'video source[data-src]',
            'audio source[data-src]']
            .join(', ')

        const lazyLoadedMediaElements = toArray(slide.querySelectorAll(lazyLoadedMediaSelector));
        lazyLoadedMediaElements.forEach(element => {
            element.setAttribute('src', element.getAttribute('data-src'));
            element.setAttribute('data-lazy-loaded', '');
            element.removeAttribute('data-src');

            // If we rewrote sources for this video/audio element, we need
            // to manually tell it to load from its new origin
            if (element.tagName === 'source' && element.parentNode.load) {
                element.parentNode.load();
            }
        });


        const background = slide.slideBackgroundElement;
        // Show the corresponding background element
        if (background) show(background);
        if (!background || background.hasAttribute('data-loaded')) {
            return;
        }
        addAttribute(background)('data-loaded', 'true');

        // If the background contains media, load it
        const backgroundContent = slide.slideBackgroundContentElement;
        const backgroundImage = slide.getAttribute('data-background-image'),
            backgroundVideo = slide.getAttribute('data-background-video'),
            backgroundVideoLoop = slide.hasAttribute('data-background-video-loop'),
            backgroundVideoMuted = slide.hasAttribute('data-background-video-muted');

        // Images
        if (backgroundImage) {
            backgroundContent.style.backgroundImage = 'url(' + encodeURI(backgroundImage) + ')';
        }
        // Videos
        else if (backgroundVideo) {
            const video = document.createElement('video');
            if (backgroundVideoLoop) video.setAttribute('loop', '');
            if (backgroundVideoMuted) video.muted = true;

            // Support comma separated lists of video sources
            backgroundVideo.split(',').forEach((source) => {
                video.innerHTML += '<source src="' + source + '">';
            });
            backgroundContent.appendChild(video);
        }
    }


	/**
	 * Unloads and hides the given slide. This is called when the
	 * slide is moved outside of the configured view distance.
	 *
	 * @param {HTMLElement} slide
	 */
    function unloadSlide(slide) {
        // Hide the slide element
        hide(slide);

        // Hide the corresponding background element
        const background = slide.slideBackgroundElement;
        if (background) hide(background);

        // Reset lazy-loaded media elements with src attributes
        const lazyLoadedMediaSelector = ['video[data-lazy-loaded][src]',
            'audio[data-lazy-loaded][src]',
            'video source[data-lazy-loaded][src]',
            'audio source[data-lazy-loaded][src]']
            .join(', ')

        const lazyLoadedMediaElements = toArray(slide.querySelectorAll(lazyLoadedMediaSelector));
        lazyLoadedMediaElements.forEach(element => {
            element.setAttribute('data-src', element.getAttribute('src'));
            element.removeAttribute('src');
        });
    }


    /**
	 * Optimization method; hide all slides that are far away from the present slide.
	 */
    function updateSlidesVisibility() {
        const slides = state.dom.slides;
        const viewDistance = config.viewDistance;

        if (!slides || typeof state.activeSlideIndex === 'undefined') return;

        slides.forEach((aSlide, aSlideIndex) => {
            // Determine how far away this slide is from the present
            let distanceX = Math.abs((state.activeSlideIndex || 0) - aSlideIndex) || 0;
            // Show the horizontal slide if it's within the view distance
            distanceX < viewDistance ? loadSlide(aSlide) : unloadSlide(aSlide);
        });
    }


    /**
	 * Updates the slide number div to reflect the current slide.
	 */
    function updateSlideNumber() {
        // Update slide number if enabled
        if (config.slideNumber && state.dom.slideNumber) {
            const totalSlides = state.dom.slides.length;
            const pastSlides = (state.activeSlideIndex || 0) + 1;
            state.dom.slideNumber.innerHTML = formatSlideNumber(pastSlides, '/', totalSlides)
        }
    }


    /**
	 * Applies HTML formatting to a slide number before it's written to the DOM.
	 *
	 * @param {number} a Current slide
	 * @param {string} delimiter Character to separate slide numbers
	 * @param {(number|*)} b Total slides
	 * @return {string} HTML string fragment
	 */
    function formatSlideNumber(a, delimiter, b) {
        const bPart = typeof b === 'number' && !isNaN(b) ?
            `<span class="slide-number-delimiter"> ${delimiter}</span>
             <span class="slide-number-b">${b}</span>`
            : ''

        return `<span class="slide-number-a">${a}</span>${bPart}`
    }


    /**
	 * Updates the state of all control/navigation arrows.
	 */
    function updateControls() {
        const routes = availableRoutes();

        if (routes.left) enable(state.dom.controlsPrev)
        else disable(state.dom.controlsPrev);

        if (routes.right) enable(state.dom.controlsNext)
        else disable(state.dom.controlsNext);
    }


    /**
     * Navigate to the specified slide fragment.
     *
     * @param {?number} index The index of the fragment that
     * should be shown, -1 means all are invisible
     * @param {number} offset Integer offset to apply to the
     * fragment index
     *
     * @return {boolean} true if a change was made in any
     * fragments visibility as part of this call
     */
    function navigateFragment(index, offset) {
        const currentSlide = state.currentSlide;
        if (!currentSlide || !config.fragments) {
            return false;
        }

        const fragments = toArray(currentSlide.querySelectorAll('.fragment'));
        if (fragments.length < 1) {
            return false;
        }

        const visibleFragments = fragments.filter(fragment => {
            return /visible/.test(fragment.className)
        })
        // If all fragments are visible just return, backwards navigation shows all fragments
        if (fragments.length === visibleFragments.length) {
            return false;
        }

        // If no index is specified, find the current
        if (!isNumber(index)) {
            var lastVisibleFragment = visibleFragments.pop();
            index = lastVisibleFragment ? visibleFragments.length : -1;
        }

        // If an offset is specified, apply it to the index
        if (isNumber(offset)) {
            index += offset;
        }

        var fragmentsShown = [],
            fragmentsHidden = [];

        fragments.forEach((element, i) => {
            // Visible fragments
            if (i <= index) {
                if (!element.classList.contains('visible')) fragmentsShown.push(element);
                element.classList.add('visible');
            }
            // Hidden fragments
            else {
                if (element.classList.contains('visible')) fragmentsHidden.push(element);
                element.classList.remove('visible');
            }
        });

        const hasNavigated = !!(fragmentsShown.length || fragmentsHidden.length);
        if (hasNavigated) {
            updateControls();
            updateProgress();
            writeURL();
        }
        return hasNavigated;
    }


    function hasNavigatedToNextFragment() {
        return navigateFragment(null, 1);
    }

    function hasNavigatedToPreviousFragment() {
        return navigateFragment(null, -1);
    }

    function navigateLeft() {
        if (!hasNavigatedToPreviousFragment() && availableRoutes().left) {
            slide(state.activeSlideIndex - 1);
        }
    }

    function navigateRight() {
        if (!hasNavigatedToNextFragment() && availableRoutes().right) {
            slide(state.activeSlideIndex + 1);
        }
    }

    function navigatePrev() {
        return !hasNavigatedToPreviousFragment() && navigateLeft();
    }

    function navigateNext() {
        return !hasNavigatedToNextFragment() && navigateRight();
    }

    /**
     * Binds all event listeners.
     */
    function addEventListeners(dom) {
        // first remove any exising listeners
        document.removeEventListener('keydown', onDocumentKeyDown, false);
        document.addEventListener('keydown', onDocumentKeyDown, false);

        window.removeEventListener('hashchange', onWindowHashChange, false);
        window.addEventListener('hashchange', onWindowHashChange, false);

        window.removeEventListener('resize', onWindowResize, false);
        window.addEventListener('resize', onWindowResize, false);

        if (dom.progress) {
            dom.progress.removeEventListener('click', onProgressClicked, false);
            dom.progress.addEventListener('click', onProgressClicked, false);
        }

        if (dom.controlsPrev && dom.controlsNext) {
            ['click'].forEach((eventName) => {
                dom.controlsPrev.removeEventListener(eventName, onNavigatePrevClicked, false);
                dom.controlsPrev.addEventListener(eventName, onNavigatePrevClicked, false);
                dom.controlsNext.removeEventListener(eventName, onNavigateNextClicked, false);
                dom.controlsNext.addEventListener(eventName, onNavigateNextClicked, false);;
            });
        }
    }


    /**
	 * Handler for the document level 'keydown' event.
	 *
	 * @param {object} event
	 */
    function onDocumentKeyDown(event) {

        // Check if there's a focused element that could be using the keyboard
        const activeElementIsCE = document.activeElement && document.activeElement.contentEditable !== 'inherit';
        const activeElementIsInput = document.activeElement && document.activeElement.tagName && /input|textarea/i.test(document.activeElement.tagName);
        const activeElementIsNotes = document.activeElement && document.activeElement.className && /speaker-notes/i.test(document.activeElement.className);

        // Disregard the event if there's a focused element or a keyboard modifier key is present
        if (activeElementIsCE || activeElementIsInput || activeElementIsNotes || (event.shiftKey && event.keyCode !== 32) || event.altKey || event.ctrlKey || event.metaKey) return;

        let triggered;
        switch (event.keyCode) {
            // p, page up
            case 80: case 33: navigatePrev(); break;
            // n, page down
            case 78: case 34: navigateNext(); break;
            // h, left
            case 72: case 37: navigateLeft(); break;
            // l, right
            case 76: case 39: navigateRight(); break;
            // home
            case 36: slide(0); break;
            // end
            case 35: slide(Number.MAX_VALUE); break;
            // space
            case 32: navigateNext(); break;
            // return
            case 13: triggered = false; break;
            // f
            case 70: enterFullscreen(); break;
            default:
                triggered = false;
        }

        // If the input resulted in a triggered action we should prevent the browsers default behavior
        if (triggered) {
            event.preventDefault && event.preventDefault();
        }
    }

    /**
     * Handler for the window level 'hashchange' event.
     */
    function onWindowHashChange(event) {
        readURL();
    }

	/**
	 * Handler for the window level 'resize' event.
	 */
    function onWindowResize(event) {
        layout(state.dom, config);
    }

    function onNavigatePrevClicked(event) { event.preventDefault(); navigatePrev(); }
    function onNavigateNextClicked(event) { event.preventDefault(); navigateNext(); }

    /**
	 * Clicking on the progress bar results in a navigation to the
	 * closest approximate horizontal slide using this equation:
	 *
	 * ( clickX / presentationWidth ) * numberOfSlides
	 */
    function onProgressClicked(event) {
        event.preventDefault();

        var slidesTotal = state.dom.slides.length;
        var slideIndex = Math.floor((event.clientX / state.dom.wrapper.offsetWidth) * slidesTotal);
        slide(slideIndex);
    }


    /**
	 * Handling the fullscreen functionality via the fullscreen API
	 */
    function enterFullscreen() {
        const element = document.documentElement;

        // Check which implementation is available
        const requestMethod = element.requestFullscreen ||
            element.webkitRequestFullscreen ||
            element.webkitRequestFullScreen ||
            element.mozRequestFullScreen ||
            element.msRequestFullscreen;

        if (requestMethod) {
            requestMethod.apply(element);
        }
    }


    /**
	 * Start playback of any embedded content inside of the given element.
	 */
    function startEmbeddedContent(element) {
        if (!element) return;

        // Restart GIFs
        toArray(element.querySelectorAll('img[src$=".gif"]')).forEach(el => {
            el.setAttribute('src', el.getAttribute('src'));
        });

        // HTML5 media elements
        toArray(element.querySelectorAll('video, audio')).forEach((el) => {
            let autoplay = el.hasAttribute('data-autoplay') ||
                el.parentNode.classList.contains('slide-background-content');

            if (autoplay && typeof el.play === 'function') {
                // If the media is ready, start playback
                if (el.readyState > 1) {
                    startEmbeddedMedia({ target: el });
                }
                // If the media isn't loaded, wait before playing
                else {
                    el.removeEventListener('loadeddata', startEmbeddedMedia); // remove first to avoid dupes
                    el.addEventListener('loadeddata', startEmbeddedMedia);
                }
            }
        });
    }


	/**
	 * Starts playing an embedded video/audio element after it has finished loading.
	 */
    function startEmbeddedMedia(event) {
        const element = event.target;
        if (element && element.parentNode) {
            element.currentTime = 0;
            element.play();

            element.removeEventListener('loadeddata', startEmbeddedMedia);
        }
    }


	/**
	 * Stop playback of any embedded content inside of the targeted slide.
	 */
    function stopEmbeddedContent(element) {
        if (element && element.parentNode) {
            // HTML5 media elements
            toArray(element.querySelectorAll('video, audio')).forEach((el) => {
                if (!el.hasAttribute('data-ignore') && typeof el.pause === 'function') {
                    el.setAttribute('data-paused-by-reveal', '');
                    el.pause();
                }
            });
        }
    }

    const RVL = {
        initialize
    };
    return RVL;
})));