module.exports = {
  sources: ['/Volumes/Movies', '/Volumes/TV Shows'],

  destinations: [
    { path: '/Volumes/backup1', size: 8 },
    { path: '/Volumes/backup2', size: 8 },
    { path: '/Volumes/backup3', size: 8 },
    { path: '/Volumes/backup4', size: 8 },
  ],

  delimiter: ':',

  parameters: {
    // Assume hard drive has X% actual capacity
    // X = 98, 8TB hard drive => 7.84TB actual
    capacity: 98,

    // Don't touch the last XGB of the drive
    // X = 8, 7.84TB actual => 7.832TB usable
    buffer: 8,

    // Assume files take X% more size on disk
    // X = 2, 1GB movie file => 1.02GB on disk
    filesystem: 2,
  },

  webhook: '',
};
