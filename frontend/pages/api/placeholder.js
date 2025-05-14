export default function handler(req, res) {
    const { width = 300, height = 300, text = "NFT" } = req.query

    // Create SVG placeholder
    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#${Math.floor(Math.random() * 16777215).toString(
          16
      )}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial" 
        font-size="48"
        fill="white"
        text-anchor="middle"
        dy=".3em"
      >${text}</text>
    </svg>
  `

    // Set headers
    res.setHeader("Content-Type", "image/svg+xml")
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable")

    // Send response
    res.status(200).send(svg)
}
