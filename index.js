        document.addEventListener('DOMContentLoaded', function() {
            const searchInput = document.querySelector('.search-input');
            const wordTitle = document.querySelector('.word');
            const definitionContent = document.querySelector('.definition-content');
            const carouselInner = document.querySelector('.carousel-inner');
            const prevButton = document.getElementById('prevButton');
            const nextButton = document.getElementById('nextButton');
            const clickableToggle = document.getElementById('clickableToggle');
            const loading = document.querySelector('.loading');
            const errorMessage = document.querySelector('.error-message');

            let searchTimeout;
            let searchHistory = [];
            let currentHistoryIndex = -1;
            let isClickableMode = false;
            let isNavigating = false;
            let currentWord = '';
            let imageCache = new Map(); // Cache for loaded images
            let preloadedImages = new Set(); // Track preloaded images

            // Enhanced image preloading function
            function preloadImage(src, priority = 'low') {
                return new Promise((resolve, reject) => {
                    if (preloadedImages.has(src)) {
                        resolve(src);
                        return;
                    }

                    const img = new Image();
                    img.style.position = 'absolute';
                    img.style.visibility = 'hidden';
                    img.style.pointerEvents = 'none';
                    
                    // Set loading priority for modern browsers
                    if ('loading' in img) {
                        img.loading = priority === 'high' ? 'eager' : 'lazy';
                    }
                    
                    // Set fetchpriority for modern browsers
                    if ('fetchPriority' in img) {
                        img.fetchPriority = priority;
                    }

                    img.onload = () => {
                        preloadedImages.add(src);
                        document.body.removeChild(img);
                        resolve(src);
                    };
                    
                    img.onerror = () => {
                        document.body.removeChild(img);
                        reject(new Error(`Failed to load image: ${src}`));
                    };

                    img.src = src;
                    document.body.appendChild(img);
                });
            }

            // Batch preload images with progressive loading
            async function preloadImages(imageUrls) {
                if (!imageUrls || imageUrls.length === 0) return [];

                const loadedImages = [];
                
                // Load first image with high priority
                if (imageUrls[0]) {
                    try {
                        await preloadImage(imageUrls[0], 'high');
                        loadedImages.push(imageUrls[0]);
                    } catch (error) {
                        console.warn('Failed to preload first image:', error);
                    }
                }

                // Load remaining images with lower priority in chunks
                const remainingImages = imageUrls.slice(1);
                const chunkSize = 3; // Load 3 images at a time
                
                for (let i = 0; i < remainingImages.length; i += chunkSize) {
                    const chunk = remainingImages.slice(i, i + chunkSize);
                    const chunkPromises = chunk.map(url => 
                        preloadImage(url, 'low').catch(error => {
                            console.warn('Failed to preload image:', error);
                            return null;
                        })
                    );
                    
                    const chunkResults = await Promise.allSettled(chunkPromises);
                    chunkResults.forEach(result => {
                        if (result.status === 'fulfilled' && result.value) {
                            loadedImages.push(result.value);
                        }
                    });
                    
                    // Small delay between chunks to prevent overwhelming the browser
                    if (i + chunkSize < remainingImages.length) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }

                return loadedImages;
            }

            async function fetchWordData(word) {
                try {
                    const [dictResponse, synonymsResponse, antonymsResponse, imageResponse] = await Promise.all([
                        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`),
                        fetch(`https://api.datamuse.com/words?rel_syn=${word}`),
                        fetch(`https://api.datamuse.com/words?rel_ant=${word}`),
                        fetch(`/api/pixabay?word=${encodeURIComponent(word)}`)
                    ]);

                    const [dictionary, synonyms, antonyms, imageData] = await Promise.all([
                        dictResponse.json(),
                        synonymsResponse.json(),
                        antonymsResponse.json(),
                        imageResponse.json()
                    ]);

                    const images = imageData.hits ? imageData.hits.map(img => img.webformatURL) : [];
                    
                    // Cache the image URLs
                    if (images.length > 0) {
                        imageCache.set(word, images);
                    }

                    return {
                        dictionary,
                        synonyms,
                        antonyms,
                        images
                    };
                } catch (error) {
                    throw new Error('Failed to fetch word data');
                }
            }

            function makeTextClickable(text) {
                if (!text) return '';
                
                // Only make words longer than 2 characters clickable to avoid short words like "a", "is", etc.
                return text.split(/\b/).map(word => {
                    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
                    if (/^[a-zA-Z]+$/.test(cleanWord) && cleanWord.length > 2) {
                        return `<span class="clickable-word" data-word="${cleanWord}">${word}</span>`;
                    }
                    return word;
                }).join('');
            }

            // Enhanced carousel creation with loading states - fixed dimensions
            function createImageCarousel(images, word) {
                if (!images || images.length === 0) {
                    return `
                        <div class="carousel-item active">
                            <div class="image-container">
                                <div class="d-flex align-items-center justify-content-center" style="width: 100%; height: 300px; background: rgba(118, 118, 128, 0.08); position: absolute; top: 0; left: 0;">
                                    <p class="text-muted">No images available for "${word}"</p>
                                </div>
                            </div>
                        </div>
                    `;
                }

                return images.map((img, index) => {
                    const isPreloaded = preloadedImages.has(img);
                    return `
                        <div class="carousel-item ${index === 0 ? 'active' : ''}" data-bs-interval="3000">
                            <div class="image-container">
                                <div class="image-loading-placeholder">
                                    <div style="color: rgba(118, 118, 128, 0.6); font-size: 0.9rem;">Loading image...</div>
                                </div>
                                <img 
                                    src="${img}" 
                                    alt="${word}" 
                                    class="carousel-image" 
                                    loading="${index === 0 ? 'eager' : 'lazy'}"
                                    fetchpriority="${index === 0 ? 'high' : 'low'}"
                                    width="100%" 
                                    height="300"
                                    style="
                                        position: absolute !important;
                                        top: 0 !important;
                                        left: 0 !important;
                                        width: 100% !important;
                                        height: 300px !important;
                                        min-height: 300px !important;
                                        max-height: 300px !important;
                                        object-fit: cover;
                                        transition: opacity 0.3s ease;
                                        opacity: 0;
                                        transform: translateZ(0);
                                        backface-visibility: hidden;
                                        display: block !important;
                                        z-index: 2;
                                    "
                                    onload="this.style.opacity='1'; const placeholder = this.parentElement.querySelector('.image-loading-placeholder'); if(placeholder) placeholder.style.display='none';"
                                    onerror="const container = this.parentElement; container.innerHTML='<div class=\\'d-flex align-items-center justify-content-center\\' style=\\'width: 100%; height: 300px; background: rgba(118, 118, 128, 0.08); position: absolute; top: 0; left: 0;\\'>Image failed to load</div>';"
                                >
                            </div>
                        </div>
                    `;
                }).join('');
            }

            async function updateUI(word, data) {
                try {
                    const { dictionary, synonyms, antonyms, images } = data;
                    
                    if (!dictionary || dictionary.error || !Array.isArray(dictionary) || dictionary.length === 0) {
                        throw new Error('Invalid dictionary data');
                    }

                    const wordData = dictionary[0];
                    currentWord = word;

                    // Update word title
                    wordTitle.textContent = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

                    // Update definition
                    let html = '';
                    
                    // Add phonetic if available
                    const phonetic = wordData.phonetic || (wordData.phonetics && wordData.phonetics[0] && wordData.phonetics[0].text) || '';
                    if (phonetic) {
                        html += `<div class="phonetic">${phonetic}</div>`;
                    }

                    // Process meanings
                    if (wordData.meanings && Array.isArray(wordData.meanings)) {
                        wordData.meanings.forEach(meaning => {
                            html += `<div class="part-of-speech">${meaning.partOfSpeech}</div>`;

                            if (meaning.definitions && Array.isArray(meaning.definitions)) {
                                meaning.definitions.forEach(definition => {
                                    const processedDefinition = isClickableMode ? 
                                        makeTextClickable(definition.definition) : 
                                        definition.definition;

                                    const processedExample = definition.example && isClickableMode ? 
                                        makeTextClickable(definition.example) : 
                                        definition.example;

                                    html += `
                                        <div class="definition-item">
                                            ${processedDefinition}
                                            ${definition.example ? `
                                                <div class="example">"${processedExample}"</div>
                                            ` : ''}
                                        </div>
                                    `;
                                });
                            }
                        });
                    }

                    // Add synonyms
                    if (synonyms && Array.isArray(synonyms) && synonyms.length > 0) {
                        html += `
                            <div class="synonyms-section">
                                <div class="part-of-speech">Synonyms</div>
                                <div>
                                    ${synonyms.slice(0, 10).map(syn => 
                                        `<span class="synonym-chip" data-word="${syn.word}">${syn.word}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        `;
                    }

                    // Add antonyms
                    if (antonyms && Array.isArray(antonyms) && antonyms.length > 0) {
                        html += `
                            <div class="antonyms-section">
                                <div class="part-of-speech">Antonyms</div>
                                <div>
                                    ${antonyms.slice(0, 10).map(ant => 
                                        `<span class="antonym-chip" data-word="${ant.word}">${ant.word}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        `;
                    }

                    definitionContent.innerHTML = html;

                    // Update images with loading optimization and layout stability
                    const carouselHTML = createImageCarousel(images, word);
                    
                    // Force carousel container stability before update
                    const carousel = carouselInner.parentElement;
                    carousel.style.cssText += `
                        width: 100% !important;
                        height: 300px !important;
                        min-height: 300px !important;
                        max-height: 300px !important;
                        overflow: hidden !important;
                        contain: layout size style !important;
                    `;
                    
                    carouselInner.style.cssText += `
                        width: 100% !important;
                        height: 300px !important;
                        min-height: 300px !important;
                        max-height: 300px !important;
                        overflow: hidden !important;
                        contain: layout size style !important;
                    `;
                    
                    // Use double requestAnimationFrame for smoother updates
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            // Only update if content actually changed
                            if (carouselInner.innerHTML !== carouselHTML) {
                                carouselInner.innerHTML = carouselHTML;
                            }
                            
                            // Start preloading images in the background
                            if (images && images.length > 0) {
                                preloadImages(images).catch(console.warn);
                            }
                        });
                    });

                } catch (error) {
                    console.error('Error updating UI:', error);
                    showError('Error displaying word information');
                }
            }

            function showError(message) {
                errorMessage.textContent = message;
                errorMessage.style.display = 'block';
                definitionContent.innerHTML = `<p class="text-muted">${message}</p>`;
                
                // Maintain stable carousel dimensions during error state
                const carousel = carouselInner.parentElement;
                carousel.style.cssText += `
                    width: 100% !important;
                    height: 300px !important;
                    min-height: 300px !important;
                    max-height: 300px !important;
                    overflow: hidden !important;
                `;
                
                carouselInner.innerHTML = `
                    <div class="carousel-item active">
                        <div class="image-container">
                            <div class="d-flex align-items-center justify-content-center" style="width: 100%; height: 300px; background: rgba(118, 118, 128, 0.08); position: absolute; top: 0; left: 0;">
                                <p class="text-muted">No image available</p>
                            </div>
                        </div>
                    </div>
                `;
                wordTitle.textContent = 'Word';
                currentWord = '';
            }

            function updateNavigationButtons() {
                const canGoPrev = currentHistoryIndex > 0 && !isNavigating;
                const canGoNext = currentHistoryIndex < searchHistory.length - 1 && !isNavigating;
                
                prevButton.disabled = !canGoPrev;
                nextButton.disabled = !canGoNext;

                console.log('Navigation:', {
                    history: searchHistory,
                    currentIndex: currentHistoryIndex,
                    canGoPrev,
                    canGoNext,
                    isNavigating
                });
            }

            function addToHistory(word) {
                word = word.toLowerCase().trim();
                
                // Don't add if empty or same as current
                if (!word || word === searchHistory[currentHistoryIndex]) {
                    return;
                }

                // If we're not at the end, remove forward history
                if (currentHistoryIndex < searchHistory.length - 1) {
                    searchHistory = searchHistory.slice(0, currentHistoryIndex + 1);
                }

                // Add new word
                searchHistory.push(word);
                currentHistoryIndex = searchHistory.length - 1;
                
                updateNavigationButtons();
            }

            async function performSearch(word, addToHistoryFlag = false) {
                word = word.toLowerCase().trim();
                if (!word) return;

                try {
                    loading.style.display = 'block';
                    errorMessage.style.display = 'none';
                    
                    const data = await fetchWordData(word);
                    
                    if (data.dictionary.error) {
                        throw new Error('Word not found');
                    }
                    
                    loading.style.display = 'none';
                    await updateUI(word, data);

                    if (addToHistoryFlag) {
                        addToHistory(word);
                    }

                } catch (error) {
                    loading.style.display = 'none';
                    showError('Word not found or connection error occurred');
                    console.error('Search error:', error);
                    
                    // Still add failed searches to history for navigation consistency
                    if (addToHistoryFlag) {
                        addToHistory(word);
                    }
                } finally {
                    isNavigating = false;
                    updateNavigationButtons();
                }
            }

            // Search input handler with debouncing
            searchInput.addEventListener('input', function(e) {
                const word = e.target.value.trim();
                
                clearTimeout(searchTimeout);
                
                if (word.length > 0) {
                    // Increase timeout to reduce frequent updates that cause vibration
                    searchTimeout = setTimeout(() => {
                        if (!isNavigating) {
                            performSearch(word, true);
                        }
                    }, 500);
                } else {
                    loading.style.display = 'none';
                    errorMessage.style.display = 'none';
                    wordTitle.textContent = 'Word';
                    definitionContent.innerHTML = '<p class="text-muted">Enter a word in the search box above to see its definition and related images.</p>';
                    
                    // Maintain stable carousel dimensions in empty state
                    const carousel = carouselInner.parentElement;
                    carousel.style.cssText += `
                        width: 100% !important;
                        height: 300px !important;
                        min-height: 300px !important;
                        max-height: 300px !important;
                        overflow: hidden !important;
                    `;
                    
                    carouselInner.innerHTML = `
                        <div class="carousel-item active">
                            <div class="image-container">
                                <div class="d-flex align-items-center justify-content-center" style="width: 100%; height: 300px; background: rgba(118, 118, 128, 0.08); position: absolute; top: 0; left: 0;">
                                    <p class="text-muted">Search for a word to see related images</p>
                                </div>
                            </div>
                        </div>
                    `;
                    currentWord = '';
                }
            });

            // Fixed navigation handlers
            prevButton.addEventListener('click', function() {
                if (isNavigating || currentHistoryIndex <= 0) {
                    console.log('Prev navigation blocked');
                    return;
                }

                isNavigating = true;
                updateNavigationButtons();

                currentHistoryIndex--;
                const word = searchHistory[currentHistoryIndex];
                searchInput.value = word;
                
                console.log('Navigating to previous word:', word);
                performSearch(word, false);
            });

            nextButton.addEventListener('click', function() {
                if (isNavigating || currentHistoryIndex >= searchHistory.length - 1) {
                    console.log('Next navigation blocked');
                    return;
                }

                isNavigating = true;
                updateNavigationButtons();

                currentHistoryIndex++;
                const word = searchHistory[currentHistoryIndex];
                searchInput.value = word;
                
                console.log('Navigating to next word:', word);
                performSearch(word, false);
            });

            // Clickable toggle
            clickableToggle.addEventListener('click', function() {
                isClickableMode = !isClickableMode;
                this.classList.toggle('active');
                document.documentElement.classList.toggle('clickable-active', isClickableMode);
                
                // Refresh current word if available
                if (currentWord) {
                    performSearch(currentWord, false);
                }
            });

            // Enhanced click handler
            document.addEventListener('click', function(e) {
                // Prevent navigation during click handling
                if (isNavigating) return;
                
                let targetWord = '';

                // Handle data-word attribute first (most reliable)
                if (e.target.hasAttribute('data-word')) {
                    targetWord = e.target.getAttribute('data-word').toLowerCase().trim();
                }
                // Handle class-based clicks
                else if (e.target.classList.contains('synonym-chip') || 
                         e.target.classList.contains('antonym-chip')) {
                    targetWord = e.target.textContent.toLowerCase().trim();
                }
                // Handle clickable words in definitions
                else if (isClickableMode && e.target.classList.contains('clickable-word')) {
                    targetWord = (e.target.getAttribute('data-word') || e.target.textContent)
                        .replace(/[^a-zA-Z]/g, '').toLowerCase().trim();
                }

                // Only search for words longer than 2 characters
                if (targetWord && targetWord.length > 2 && targetWord !== currentWord) {
                    console.log('Clicked word:', targetWord);
                    searchInput.value = targetWord;
                    performSearch(targetWord, true);
                }
            });

            // Initialize
            updateNavigationButtons();

            // Prefetch popular words' images for better initial experience
            const popularWords = ['cat', 'dog', 'car', 'house', 'tree'];
            setTimeout(() => {
                popularWords.forEach(word => {
                    if (!imageCache.has(word)) {
                        fetchWordData(word).then(data => {
                            if (data.images && data.images.length > 0) {
                                preloadImages(data.images.slice(0, 3)).catch(console.warn);
                            }
                        }).catch(() => {});
                    }
                });
            }, 2000);
        });
    