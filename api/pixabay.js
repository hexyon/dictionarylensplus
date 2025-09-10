// pages/api/pixabay.js
export default async function handler(req, res) {
  const { word } = req.query;
  const apiKey = process.env.PIXABAY_API_KEY;
  
  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(word)}&image_type=photo`
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch image data' });
  }
}
