
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

                    return {
                        dictionary,
                        synonyms,
                        antonyms,
                        images: imageData.hits ? imageData.hits.map(img => img.webformatURL) : []
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

            function updateUI(word, data) {
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

                    // Update images
                    if (images && Array.isArray(images) && images.length > 0) {
                        carouselInner.innerHTML = images.map((img, index) => `
                            <div class="carousel-item ${index === 0 ? 'active' : ''}" data-bs-interval="3000">
                                <img src="${img}" alt="${word}" class="d-block w-100" loading="lazy">
                            </div>
                        `).join('');
                    } else {
                        carouselInner.innerHTML = `
                            <div class="carousel-item active">
                                <div class="d-flex align-items-center justify-content-center" style="height: 300px; background: rgba(118, 118, 128, 0.08);">
                                    <p class="text-muted">No images available for "${word}"</p>
                                </div>
                            </div>
                        `;
                    }
                } catch (error) {
                    console.error('Error updating UI:', error);
                    showError('Error displaying word information');
                }
            }

            function showError(message) {
                errorMessage.textContent = message;
                errorMessage.style.display = 'block';
                definitionContent.innerHTML = `<p class="text-muted">${message}</p>`;
                carouselInner.innerHTML = `
                    <div class="carousel-item active">
                        <div class="d-flex align-items-center justify-content-center" style="height: 300px; background: rgba(118, 118, 128, 0.08);">
                            <p class="text-muted">No image available</p>
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
                    updateUI(word, data);

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

            // Search input handler
            searchInput.addEventListener('input', function(e) {
                const word = e.target.value.trim();
                
                clearTimeout(searchTimeout);
                
                if (word.length > 0) {
                    searchTimeout = setTimeout(() => {
                        if (!isNavigating) {
                            performSearch(word, true);
                        }
                    }, 300);
                } else {
                    loading.style.display = 'none';
                    errorMessage.style.display = 'none';
                    wordTitle.textContent = 'Word';
                    definitionContent.innerHTML = '<p class="text-muted">Enter a word in the search box above to see its definition and related images.</p>';
                    carouselInner.innerHTML = `
                        <div class="carousel-item active">
                            <div class="d-flex align-items-center justify-content-center" style="height: 300px; background: rgba(118, 118, 128, 0.08);">
                                <p class="text-muted">Search for a word to see related images</p>
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
        });
    
