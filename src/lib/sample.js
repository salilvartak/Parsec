// Sample payload from the original design.
export const SAMPLE = {
  status: 'success',
  code: 200,
  data: {
    user: {
      id: 'usr_8f2a1c',
      name: 'Priya Natarajan',
      email: 'priya.n@example.com',
      verified: true,
      roles: ['admin', 'billing'],
      createdAt: '2023-11-02T14:22:01Z',
    },
    order: {
      id: 'ord_44210',
      status: 'fulfilled',
      total: 214.5,
      currency: 'USD',
      items: [
        { sku: 'BLK-TEE-M', name: 'Black Tee', qty: 2, price: 28 },
        { sku: 'WHT-CAP-01', name: 'White Cap', qty: 1, price: 18.5 },
      ],
      shipping: {
        carrier: 'UPS',
        trackingNumber: '1Z999AA10123456784',
        estimatedDelivery: '2026-07-29',
        address: { line1: '221B Baker Street', city: 'Austin', state: 'TX', zip: '73301' },
      },
    },
    metadata: null,
  },
  warnings: [],
};

// Second sample used to seed the diff view (order-v1 vs order-v2 from the design).
export const DIFF_SAMPLE_A = {
  id: 'ord_44210',
  status: 'processing',
  total: 196.0,
  currency: 'USD',
  items: [{ sku: 'BLK-TEE-M', qty: 2, price: 28.0 }],
  shipping: { carrier: 'USPS', trackingNumber: null },
};
export const DIFF_SAMPLE_B = {
  id: 'ord_44210',
  status: 'fulfilled',
  total: 214.5,
  currency: 'USD',
  items: [
    { sku: 'BLK-TEE-M', qty: 2, price: 28.0 },
    { sku: 'WHT-CAP-01', qty: 1, price: 18.5 },
  ],
  shipping: { carrier: 'UPS', trackingNumber: '1Z999AA10123456784' },
};
