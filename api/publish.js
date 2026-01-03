// Vercel Serverless Function for Publishing Articles to GitHub
// Token is stored securely in Vercel environment variables

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { password, slug, markdown, title } = req.body;

        // Verify password
        if (password !== 'blogi2026') {
            return res.status(401).json({ error: 'Invalid password' });
        }

        if (!slug || !markdown) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get credentials from environment variables
        const token = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER || 'Vivekdixit11';
        const repo = process.env.GITHUB_REPO || 'Blogg-inn';

        if (!token) {
            return res.status(500).json({ error: 'GitHub token not configured' });
        }

        const filename = `${slug}.md`;
        const path = `src/content/articles/${filename}`;

        // Check if file exists (to get SHA for update)
        let sha = null;
        try {
            const existingFile = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                headers: { 'Authorization': `token ${token}` }
            });
            if (existingFile.ok) {
                const data = await existingFile.json();
                sha = data.sha;
            }
        } catch (e) {
            // File doesn't exist, that's fine
        }

        // Create or update file
        const body = {
            message: sha ? `Update article: ${title || slug}` : `Add article: ${title || slug}`,
            content: Buffer.from(markdown).toString('base64'),
            branch: 'main'
        };

        if (sha) body.sha = sha;

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json({ error: error.message });
        }

        const result = await response.json();

        return res.status(200).json({
            success: true,
            message: 'Article published successfully',
            url: `/articles/${slug}.html`,
            commit: result.commit?.sha
        });

    } catch (error) {
        console.error('Publish error:', error);
        return res.status(500).json({ error: error.message });
    }
}
