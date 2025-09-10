// pages/api/pixabay.js
export default async function handler(req, res) {
  const { word } = req.query;
  const apiKey = process.env.PIXABAY_API_KEY;
  
  // Set cache headers for better performance
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  
  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(word)}&image_type=photo&per_page=12&min_width=640&min_height=480&safesearch=true&order=popular`,
      {
        headers: {
          'User-Agent': 'DictionaryLensPlus/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Pixabay API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Optimize the response by selecting smaller images for faster loading
    if (data.hits && Array.isArray(data.hits)) {
      data.hits = data.hits.map(hit => ({
        ...hit,
        // Prefer smaller but still good quality images
        webformatURL: hit.webformatURL || hit.previewURL
      }));
    }
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Pixabay API error:', error);
    res.status(500).json({ error: 'Failed to fetch image data' });
  }
}
