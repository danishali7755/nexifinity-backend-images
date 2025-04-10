
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const YOUTUBE_API_KEY = 'AIzaSyCirrq-wAOf30Wv3GgqtuWFD1KQCUbwLcw';

const extractHandle = (url) => {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([\w-]+)/);
  return match ? match[1] : null;
};

const estimateCPM = (views) => {
  const low = views * 0.5 / 1000;
  const high = views * 2.0 / 1000;
  return "$" + low.toFixed(0) + " - $" + high.toFixed(0);
};

const getViewAverages = (totalViews, creationDate) => {
  const daysSinceCreation = Math.max(
    1,
    Math.floor((Date.now() - new Date(creationDate).getTime()) / (1000 * 60 * 60 * 24))
  );
  const viewsPerDay = totalViews / daysSinceCreation;
  return {
    perDay: Math.round(viewsPerDay),
    perMonth: Math.round(viewsPerDay * 30),
    perYear: Math.round(viewsPerDay * 365)
  };
};

const inferReligiousKeywords = (text) => {
  const religionMap = {
    Christianity: [/christ|jesus|bible|church/i],
    Islam: [/muslim|allah|quran|islam/i],
    Judaism: [/jewish|torah|synagogue/i],
    Hinduism: [/hindu|vedic|gita|temple/i],
    Buddhism: [/buddha|dharma|sangha/i]
  };

  for (const religion in religionMap) {
    if (religionMap[religion].some((r) => r.test(text))) return religion;
  }
  return "Not Detected";
};

app.get('/api/check', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  const handle = extractHandle(url);
  if (!handle) return res.status(400).json({ error: 'Invalid YouTube handle URL format.' });

  try {
    const searchUrl = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=" + handle + "&key=" + YOUTUBE_API_KEY;
    const searchResp = await axios.get(searchUrl);
    const items = searchResp.data.items;
    if (!items.length) throw new Error('Channel not found');

    const channelId = items[0].snippet.channelId;

    const statsUrl = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,topicDetails,brandingSettings&id=" + channelId + "&key=" + YOUTUBE_API_KEY;
    const statsResp = await axios.get(statsUrl);
    const channel = statsResp.data.items[0];

    const title = channel.snippet.title;
    const country = channel.snippet.country || 'Unknown';
    const publishedAt = channel.snippet.publishedAt;
    const publishedDate = new Date(publishedAt);
    const age = publishedDate.toISOString().split('T')[0];

    const views = parseInt(channel.statistics.viewCount);
    const subs = parseInt(channel.statistics.subscriberCount || 0);
    const videos = parseInt(channel.statistics.videoCount);
    const niche = channel.snippet.description.split(' ').slice(0, 8).join(' ');
    const topics = channel.topicDetails?.topicCategories || [];

    const monetized = subs >= 1000 && views >= 4000000;
    const earnings = estimateCPM(views);
    const viewAverages = getViewAverages(views, publishedAt);
    const description = channel.snippet.description;
    const religion = inferReligiousKeywords(description);
    const channelUrl = "https://youtube.com/channel/" + channelId;

    const profileImage = channel.snippet.thumbnails.high.url;
    const coverArt = channel.brandingSettings && channel.brandingSettings.image
      ? channel.brandingSettings.image.bannerExternalUrl
      : null;

    res.json({
      channelName: title,
      region: country,
      age,
      channelUrl,
      description,
      views: views.toLocaleString(),
      subscribers: subs.toLocaleString(),
      videos: videos.toLocaleString(),
      earnings,
      monetized,
      averages: viewAverages,
      niche,
      isForKids: 'Not available in API',
      topicCategories: topics,
      religion,
      profileImage,
      coverArt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch channel data', details: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("API running on port " + PORT));

