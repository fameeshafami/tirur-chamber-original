const QrCode = require('../models/QrCode');
const News = require('../models/News');
const Offer = require('../models/Offer');
const Ad = require('../models/Ad');
const HeroSlide = require('../models/HeroSlide');
const Business = require('../models/Business');
const Job = require('../models/Job');
const ChamberMembership = require('../models/ChamberMembership');
const CommunityUpdate = require('../models/CommunityUpdate');
const { expireElapsedMemberships, membershipExpiry } = require('../services/chamberMembership');

// A QR scan must never reveal account credentials, payment data, or dashboard data.
const getMemberVerification = async (req, res) => {
  const publicId = String(req.params.publicId || req.params.code || '').trim();
  if (!publicId) return res.status(400).json({ message: 'A verification code is required.' });

  await expireElapsedMemberships();
  const qr = await QrCode.findOne({ $or: [{ publicId }, { code: publicId }] }).populate('membership');
  const membership = qr?.membership;
  if (!membership) return res.status(404).json({ message: 'No Chamber membership was found for this QR code.' });

  const publicProfile = membership.publicProfile || {};
  return res.json({
    member: {
      verificationId: (qr.publicId || qr.code).toUpperCase(),
      businessName: publicProfile.businessName || membership.businessName,
      ownerName: publicProfile.ownerName || membership.ownerName,
      category: publicProfile.category || membership.category,
      phone: publicProfile.phone || membership.phone,
      email: publicProfile.email || membership.email,
      address: publicProfile.address || '',
      description: publicProfile.description || '',
      logo: membership.logo || '',
      website: membership.website || '',
      plan: membership.plan || '',
      membershipNumber: membership.membershipNumber || '',
      status: membership.status,
      membershipExpiryDate: membershipExpiry(membership) || null,
      qrStatus: qr.status,
      verified: membership.status === 'active' && qr.status === 'active',
    },
  });
};

const pagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const publicNews = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { status: 'published' };
  if (req.query.search) {
    const expression = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ title: expression }, { description: expression }, { content: expression }, { category: expression }];
  }
  if (req.query.category) filter.category = req.query.category;
  const [data, total] = await Promise.all([
    News.find(filter).populate('author', 'name').sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
    News.countDocuments(filter),
  ]);
  res.json({ data, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } });
};
const publicNewsItem = async (req, res) => {
  const news = await News.findOne({ slug: req.params.slug, status: 'published' }).populate('author', 'name');
  if (!news) return res.status(404).json({ message: 'News not found.' });
  res.json({ news });
};
const publicUpdates = async (req, res) => {
  const [businessCount, activeMembers, latestBusiness, latestJob, latestAd] = await Promise.all([
    Business.countDocuments({ status: 'approved' }),
    ChamberMembership.countDocuments({ status: 'active' }),
    Business.findOne({ status: 'approved' }).sort({ createdAt: -1 }).select('name createdAt'),
    Job.findOne({ status: 'published' }).sort({ createdAt: -1 }).select('title company createdAt'),
    Ad.findOne({ status: 'published', enabled: true }).sort({ createdAt: -1 }).select('title createdAt'),
  ]);
  const updates = [
    businessCount ? { icon: '🏬', title: `${businessCount} shops joined the directory`, createdAt: latestBusiness?.createdAt } : null,
    latestJob ? { icon: '💼', title: `${latestJob.company || 'A local business'} is hiring — ${latestJob.title}`, createdAt: latestJob.createdAt } : null,
    activeMembers ? { icon: '🏅', title: `Tirur Chamber has ${activeMembers} active members`, createdAt: new Date() } : null,
    latestAd ? { icon: '📢', title: `${latestAd.title} is featured on the homepage`, createdAt: latestAd.createdAt } : null,
  ].filter(Boolean).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  res.json({ data: updates.slice(0, 4) });
};
const publicCommunityUpdates = async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const adFilter = {
    status: { $in: ['active', 'published'] },
    enabled: true,
    $and: [
      { $or: [{ position: 'homepage' }, { placement: 'homepage' }] },
      { $or: [{ startAt: null }, { startAt: { $lte: now } }, { startDate: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }, { endDate: { $gte: now } }] },
    ],
  };
  const [manualUpdates, newShopCount, latestShop, activeMemberCount, latestActiveMember, latestJob, activeAdCount, latestAd] = await Promise.all([
    CommunityUpdate.find({
      status: 'active',
      category: { $in: ['shops_joined', 'hirings', 'active_members', 'ad_slots'] },
      $and: [
        { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
      ],
    }).sort({ createdAt: -1 }).limit(50).select('category text icon createdAt'),
    Business.countDocuments({ status: 'approved', createdAt: { $gte: monthStart, $lte: now } }),
    Business.findOne({ status: 'approved', createdAt: { $gte: monthStart, $lte: now } }).sort({ createdAt: -1 }).select('createdAt'),
    ChamberMembership.countDocuments({ status: 'active' }),
    ChamberMembership.findOne({ status: 'active' }).sort({ updatedAt: -1 }).select('createdAt updatedAt'),
    Job.findOne({ status: 'published', $or: [{ closingDate: null }, { closingDate: { $gte: now } }] }).sort({ publishedAt: -1, createdAt: -1 }).select('title company publishedAt createdAt'),
    Ad.countDocuments(adFilter),
    Ad.findOne(adFilter).sort({ order: 1, createdAt: -1 }).select('title createdAt'),
  ]);

  const updatesByCategory = new Map();
  manualUpdates.forEach((update) => {
    if (!updatesByCategory.has(update.category)) updatesByCategory.set(update.category, update);
  });

  const derivedUpdates = [
    newShopCount ? {
      category: 'shops_joined', icon: '🏪',
      text: `${newShopCount} new shop${newShopCount === 1 ? '' : 's'} joined the directory this month`,
      createdAt: latestShop.createdAt,
    } : null,
    latestJob ? {
      category: 'hirings', icon: '💼',
      text: `${latestJob.company || 'A local business'} is hiring — ${latestJob.title}`,
      createdAt: latestJob.publishedAt || latestJob.createdAt,
    } : null,
    activeMemberCount ? {
      category: 'active_members', icon: '🏆',
      text: `Tirur Chamber has ${activeMemberCount} active member${activeMemberCount === 1 ? '' : 's'}`,
      createdAt: latestActiveMember?.updatedAt || latestActiveMember?.createdAt,
    } : null,
    activeAdCount ? {
      category: 'ad_slots', icon: '📢',
      text: `Homepage advertisement: ${latestAd?.title || `${activeAdCount} active ad${activeAdCount === 1 ? '' : 's'}`}`,
      createdAt: latestAd?.createdAt,
    } : null,
  ].filter(Boolean);

  derivedUpdates.forEach((update) => {
    if (!updatesByCategory.has(update.category)) updatesByCategory.set(update.category, update);
  });

  const updates = [...updatesByCategory.values()]
    .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))
    .slice(0, 4);
  res.json({ data: updates });
};
const publicOffers = async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const now = new Date();
  await Offer.updateMany({ status: 'published', endDate: { $lt: now } }, { $set: { status: 'expired' } });
  const filter = { status: 'published', startDate: { $lte: now }, endDate: { $gte: now } };
  if (req.query.search) filter.title = new RegExp(escapeRegex(req.query.search.trim()), 'i');
  if (req.query.category) filter.category = req.query.category;
  const [data, total] = await Promise.all([
    Offer.find(filter).populate('business', 'name businessName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Offer.countDocuments(filter),
  ]);
  res.json({ data, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } });
};
const publicOffer = async (req, res) => {
  const now = new Date();
  const offer = await Offer.findOne({ _id: req.params.id, status: 'published', startDate: { $lte: now }, endDate: { $gte: now } }).populate('business', 'name businessName');
  if (!offer) return res.status(404).json({ message: 'Offer not found.' });
  res.json({ offer });
};

const publicAds = async (req, res) => {
  const requestedPosition = String(req.query.position || req.query.placement || '').trim().toLowerCase();
  if (['left', 'right'].includes(requestedPosition)) {
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date()).reduce((parts, part) => {
      if (part.type !== 'literal') parts[part.type] = part.value;
      return parts;
    }, {});
    const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const dateAsKolkataDay = (fieldNames) => ({
      $dateToString: {
        format: '%Y-%m-%d',
        date: { $convert: { input: { $ifNull: fieldNames }, to: 'date', onError: null, onNull: null } },
        timezone: 'Asia/Kolkata',
      },
    });
    const sideExpression = {
      $let: {
        vars: {
          normalizedSide: {
            $toLower: {
              $trim: {
                input: { $ifNull: ['$side', { $ifNull: ['$position', '$placement'] }] },
              },
            },
          },
        },
        in: {
          $switch: {
            branches: [
              { case: { $in: ['$$normalizedSide', ['left', 'sidebar-left']] }, then: 'left' },
              { case: { $in: ['$$normalizedSide', ['right', 'sidebar-right']] }, then: 'right' },
              { case: { $in: ['$$normalizedSide', ['homepage', 'directory']] }, then: '$$normalizedSide' },
            ],
            default: 'homepage',
          },
        },
      },
    };
    const ads = await Ad.aggregate([
      { $match: { status: 'published', enabled: true, $or: [{ approval_status: 'approved' }, { approved: true }] } },
      {
        $set: {
          _normalizedSide: sideExpression,
          _startDateKolkata: dateAsKolkataDay(['$startDate', '$startAt']),
          _endDateKolkata: dateAsKolkataDay(['$endDate', '$endAt']),
        },
      },
      {
        $match: {
          _normalizedSide: requestedPosition,
          _startDateKolkata: { $lte: today },
          _endDateKolkata: { $gte: today },
        },
      },
      { $set: { _sideOrderSort: { $ifNull: ['$sideOrder', 4] } } },
      { $sort: { _sideOrderSort: 1, createdAt: -1 } },
      { $limit: 3 },
      {
        $set: {
          imageUrl: {
            $cond: [
              { $ne: [{ $ifNull: ['$imageUrl', ''] }, ''] },
              '$imageUrl',
              '$image_url',
            ],
          },
          side: '$_normalizedSide',
        },
      },
      { $unset: ['_normalizedSide', '_startDateKolkata', '_endDateKolkata', '_sideOrderSort'] },
    ]);
    const data = ads.map((ad) => ({
      ...ad,
      adTitle: typeof ad.adTitle === 'string' ? ad.adTitle.replace(/<[^>]*>/g, '').trim().slice(0, 60) || null : null,
      description: typeof ad.description === 'string' ? ad.description.replace(/<[^>]*>/g, '').trim().slice(0, 120) || null : null,
    }));
    return res.json({ data });
  }

  const now = new Date();
  const statusFilter = { $in: ['active', 'published'] };
  const dateFilter = {
    $and: [
      { $or: [{ startAt: { $lte: now } }, { startDate: { $lte: now } }] },
      { $or: [{ endAt: { $gte: now } }, { endDate: { $gte: now } }] },
    ],
  };
  const filter = {
    status: statusFilter,
    enabled: true,
    ...dateFilter,
    $and: [...dateFilter.$and, { $or: [{ approval_status: 'approved' }, { approved: true }] }],
  };
  const placementMap = {
    left: ['left', 'sidebar-left'],
    right: ['right', 'sidebar-right'],
    homepage: ['homepage'],
    directory: ['directory'],
    'sidebar-left': ['left', 'sidebar-left'],
    'sidebar-right': ['right', 'sidebar-right'],
  };

  if (requestedPosition) {
    const aliases = placementMap[requestedPosition] || [requestedPosition];
    filter.$or = [
      { position: { $in: aliases } },
      { placement: { $in: aliases } },
    ];
  }

  const query = Ad.find(filter).sort({ order: 1, createdAt: -1 });
  if (['left', 'right'].includes(requestedPosition)) query.limit(3);
  const ads = await query;
  const data = ads.map((ad) => {
    const item = ad.toObject();
    item.imageUrl = item.imageUrl || item.image_url || '';
    return item;
  });
  res.json({ data });
};

const publicHeroSlides = async (req, res) => {
  const now = new Date();
  const slides = await HeroSlide.find({
    active: true,
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  }).sort({ createdAt: -1 }).limit(6);
  slides.sort((left, right) => left.order - right.order || right.createdAt - left.createdAt);
  res.json({ data: slides.map((slide) => {
    const item = slide.toObject();
    item.desktopImage = item.desktopImage || item.image_url || '';
    item.wideImage = item.wideImage || item.wide_image_url || '';
    item.mobileImage = item.mobileImage || item.mobile_image_url || '';
    item.show_text = item.show_text === true;
    item.title = typeof item.title === 'string' ? item.title.replace(/<[^>]*>/g, '').trim().slice(0, 80) : '';
    item.description = typeof item.description === 'string' ? item.description.replace(/<[^>]*>/g, '').trim().slice(0, 160) : '';
    return item;
  }) });
};

module.exports = { getMemberVerification, publicNews, publicNewsItem, publicUpdates, publicCommunityUpdates, publicOffers, publicOffer, publicAds, publicHeroSlides };
