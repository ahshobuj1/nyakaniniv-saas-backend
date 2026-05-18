-- Test Data for DevScout DJ Platform (DQL/DML)
-- Generated to populate all tables with at least 5 rows.

-- 1. users
INSERT INTO
    users (
        "id",
        "first_name",
        "last_name",
        "email",
        "password",
        "role",
        "profile_img",
        "is_verified",
        "otp",
        "otp_expiry",
        "created_at",
        "updated_at"
    )
VALUES (
        '11111111-1111-1111-1111-111111111111',
        'Admin',
        'Super',
        'admin@example.com',
        'hashed_pw',
        'SUPER_ADMIN',
        'admin.png',
        true,
        NULL,
        NULL,
        NOW(),
        NOW()
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'John',
        'Doe',
        'john@example.com',
        'hashed_pw',
        'DJ',
        'john.png',
        true,
        NULL,
        NULL,
        NOW(),
        NOW()
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'Jane',
        'Smith',
        'jane@example.com',
        'hashed_pw',
        'DJ',
        'jane.png',
        true,
        NULL,
        NULL,
        NOW(),
        NOW()
    ),
    (
        '44444444-4444-4444-4444-444444444444',
        'Mike',
        'Johnson',
        'mike@example.com',
        'hashed_pw',
        'DJ',
        'mike.png',
        false,
        '1234',
        NOW() + INTERVAL '1 hour',
        NOW(),
        NOW()
    ),
    (
        '55555555-5555-5555-5555-555555555555',
        'Sarah',
        'Williams',
        'sarah@example.com',
        'hashed_pw',
        'DJ',
        'sarah.png',
        true,
        NULL,
        NULL,
        NOW(),
        NOW()
    );

-- 2. themes
INSERT INTO
    themes (
        "id",
        "name",
        "slug",
        "preview_image_url",
        "default_config",
        "created_at",
        "updated_at"
    )
VALUES (
        1,
        'Dark Mode',
        'dark-mode',
        'dark.png',
        '{"color": "black"}',
        NOW(),
        NOW()
    ),
    (
        2,
        'Light Mode',
        'light-mode',
        'light.png',
        '{"color": "white"}',
        NOW(),
        NOW()
    ),
    (
        3,
        'Neon Lights',
        'neon-lights',
        'neon.png',
        '{"color": "neon"}',
        NOW(),
        NOW()
    ),
    (
        4,
        'Vintage Minimal',
        'vintage-minimal',
        'vintage.png',
        '{"color": "sepia"}',
        NOW(),
        NOW()
    ),
    (
        5,
        'Cyberpunk',
        'cyberpunk',
        'cyberpunk.png',
        '{"color": "purple"}',
        NOW(),
        NOW()
    );

-- 3. tenants
INSERT INTO
    tenants (
        "id",
        "user_id",
        "subdomain",
        "stage_name",
        "country",
        "city",
        "genres",
        "theme_id",
        "logo_url",
        "bio",
        "timezone",
        "is_active",
        "social_links",
        "config",
        "created_at",
        "updated_at"
    )
VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222',
        'dj-john',
        'DJ JD',
        'US',
        'New York',
        '["House", "Techno"]',
        1,
        'logo1.png',
        'Bio for John',
        'UTC',
        true,
        '{"twitter": "@djjd"}',
        '{"theme": "dark"}',
        NOW(),
        NOW()
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '33333333-3333-3333-3333-333333333333',
        'dj-jane',
        'Jane Beats',
        'UK',
        'London',
        '["Trance", "EDM"]',
        2,
        'logo2.png',
        'Bio for Jane',
        'UTC',
        true,
        '{"instagram": "@janebeats"}',
        '{"theme": "light"}',
        NOW(),
        NOW()
    ),
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '44444444-4444-4444-4444-444444444444',
        'dj-mike',
        'Mike Drop',
        'CA',
        'Toronto',
        '["Hip Hop", "R&B"]',
        3,
        'logo3.png',
        'Bio for Mike',
        'EST',
        true,
        '{"facebook": "mikedrop"}',
        '{"theme": "neon"}',
        NOW(),
        NOW()
    ),
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '55555555-5555-5555-5555-555555555555',
        'dj-sarah',
        'Sarah Spin',
        'AU',
        'Sydney',
        '["Dubstep"]',
        4,
        'logo4.png',
        'Bio for Sarah',
        'AEST',
        true,
        '{"soundcloud": "sarahspin"}',
        '{"theme": "vintage"}',
        NOW(),
        NOW()
    ),
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        '11111111-1111-1111-1111-111111111111',
        'admin-stage',
        'Admin Stage',
        'US',
        'LA',
        '["All"]',
        5,
        'logo5.png',
        'Admin Bio',
        'PST',
        true,
        '{}',
        '{"theme": "cyberpunk"}',
        NOW(),
        NOW()
    );

-- 4. subscription_plans
INSERT INTO
    subscription_plans (
        "id",
        "name",
        "price_monthly",
        "price_annually",
        "stripe_monthly_price_id",
        "stripe_annual_price_id",
        "discount_percentage",
        "features",
        "created_at",
        "updated_at"
    )
VALUES (
        1,
        'Basic',
        9.99,
        99.99,
        'price_basic_mo',
        'price_basic_yr',
        10,
        '{"max_events": 5}',
        NOW(),
        NOW()
    ),
    (
        2,
        'Pro',
        19.99,
        199.99,
        'price_pro_mo',
        'price_pro_yr',
        15,
        '{"max_events": 20}',
        NOW(),
        NOW()
    ),
    (
        3,
        'Elite',
        29.99,
        299.99,
        'price_elite_mo',
        'price_elite_yr',
        20,
        '{"max_events": 50}',
        NOW(),
        NOW()
    ),
    (
        4,
        'Ultimate',
        49.99,
        499.99,
        'price_ult_mo',
        'price_ult_yr',
        25,
        '{"max_events": -1}',
        NOW(),
        NOW()
    ),
    (
        5,
        'Free Trial',
        0.00,
        0.00,
        'price_free',
        'price_free',
        0,
        '{"max_events": 1}',
        NOW(),
        NOW()
    );

-- 5. subscriptions
INSERT INTO
    subscriptions (
        "id",
        "user_id",
        "plan_id",
        "stripe_sub_id",
        "status",
        "period_end",
        "created_at",
        "updated_at"
    )
VALUES (
        '10000000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        1,
        'sub_123',
        'active',
        NOW() + INTERVAL '30 days',
        NOW(),
        NOW()
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        '33333333-3333-3333-3333-333333333333',
        2,
        'sub_124',
        'active',
        NOW() + INTERVAL '30 days',
        NOW(),
        NOW()
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        '44444444-4444-4444-4444-444444444444',
        3,
        'sub_125',
        'past_due',
        NOW() - INTERVAL '5 days',
        NOW(),
        NOW()
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        '55555555-5555-5555-5555-555555555555',
        4,
        'sub_126',
        'canceled',
        NOW() - INTERVAL '15 days',
        NOW(),
        NOW()
    ),
    (
        '10000000-0000-0000-0000-000000000005',
        '11111111-1111-1111-1111-111111111111',
        5,
        'sub_127',
        'active',
        NOW() + INTERVAL '7 days',
        NOW(),
        NOW()
    );

-- 6. mix_tapes
INSERT INTO
    mix_tapes (
        "id",
        "tenant_id",
        "title",
        "audio_url",
        "cover_url",
        "order",
        "created_at",
        "updated_at"
    )
VALUES (
        '11000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Summer Mix 2023',
        'audio1.mp3',
        'cover1.png',
        1,
        NOW(),
        NOW()
    ),
    (
        '11000000-0000-0000-0000-000000000002',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'Winter Chill',
        'audio2.mp3',
        'cover2.png',
        2,
        NOW(),
        NOW()
    ),
    (
        '11000000-0000-0000-0000-000000000003',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Workout Beats',
        'audio3.mp3',
        'cover3.png',
        3,
        NOW(),
        NOW()
    ),
    (
        '11000000-0000-0000-0000-000000000004',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'Party Anthems',
        'audio4.mp3',
        'cover4.png',
        4,
        NOW(),
        NOW()
    ),
    (
        '11000000-0000-0000-0000-000000000005',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'Deep Focus',
        'audio5.mp3',
        'cover5.png',
        5,
        NOW(),
        NOW()
    );

-- 7. events
INSERT INTO
    events (
        "id",
        "tenant_id",
        "title",
        "description",
        "event_date",
        "venue_name",
        "venue_address",
        "capacity",
        "price",
        "status",
        "created_at",
        "updated_at"
    )
VALUES (
        '20000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Club Night',
        'A great night',
        '2026-06-01',
        'Club X',
        '123 Main St',
        500,
        20.00,
        'upcoming',
        NOW(),
        NOW()
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'Festival Stage',
        'Big festival',
        '2026-07-15',
        'Park Y',
        '456 Broad St',
        5000,
        100.00,
        'upcoming',
        NOW(),
        NOW()
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Private Party',
        'VIP only',
        '2025-12-31',
        'Mansion Z',
        '789 High St',
        100,
        50.00,
        'completed',
        NOW(),
        NOW()
    ),
    (
        '20000000-0000-0000-0000-000000000004',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'Rave',
        'Underground rave',
        '2026-08-20',
        'Warehouse',
        '321 Low St',
        1000,
        30.00,
        'cancelled',
        NOW(),
        NOW()
    ),
    (
        '20000000-0000-0000-0000-000000000005',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'Sunset Cruise',
        'On a boat',
        '2026-09-10',
        'Marina',
        '654 Port St',
        200,
        75.00,
        'upcoming',
        NOW(),
        NOW()
    );

-- 8. bookings
INSERT INTO
    bookings (
        "id",
        "tenant_id",
        "client_name",
        "client_email",
        "event_type",
        "event_details",
        "status",
        "total_amount",
        "created_at",
        "updated_at"
    )
VALUES (
        '30000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Client A',
        'clientA@mail.com',
        'Wedding',
        '4 hours set',
        'pending',
        500.00,
        NOW(),
        NOW()
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'Client B',
        'clientB@mail.com',
        'Corporate',
        '2 hours set',
        'accepted',
        300.00,
        NOW(),
        NOW()
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Client C',
        'clientC@mail.com',
        'Birthday',
        '3 hours set',
        'completed',
        400.00,
        NOW(),
        NOW()
    ),
    (
        '30000000-0000-0000-0000-000000000004',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'Client D',
        'clientD@mail.com',
        'Club Event',
        '5 hours set',
        'pending',
        600.00,
        NOW(),
        NOW()
    ),
    (
        '30000000-0000-0000-0000-000000000005',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'Client E',
        'clientE@mail.com',
        'Private Party',
        '4 hours set',
        'accepted',
        500.00,
        NOW(),
        NOW()
    );

-- 9. invoices
INSERT INTO
    invoices (
        "id",
        "tenant_id",
        "booking_id",
        "user_id",
        "amount",
        "type",
        "method",
        "status",
        "created_at",
        "updated_at"
    )
VALUES (
        '40000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '30000000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        500.00,
        'BOOKING',
        'STRIPE',
        'unpaid',
        NOW(),
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000002',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '30000000-0000-0000-0000-000000000002',
        '33333333-3333-3333-3333-333333333333',
        300.00,
        'BOOKING',
        'CASH',
        'paid',
        NOW(),
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000003',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '30000000-0000-0000-0000-000000000003',
        '44444444-4444-4444-4444-444444444444',
        400.00,
        'BOOKING',
        'STRIPE',
        'paid',
        NOW(),
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000004',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        NULL,
        '55555555-5555-5555-5555-555555555555',
        49.99,
        'SUBSCRIPTION',
        'STRIPE',
        'unpaid',
        NOW(),
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000005',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        NULL,
        '11111111-1111-1111-1111-111111111111',
        19.99,
        'SUBSCRIPTION',
        'STRIPE',
        'paid',
        NOW(),
        NOW()
    );

-- 10. webhook_events
INSERT INTO
    webhook_events (
        "id",
        "stripe_event_id",
        "type",
        "status",
        "created_at"
    )
VALUES (
        '50000000-0000-0000-0000-000000000001',
        'evt_1',
        'invoice.paid',
        'processed',
        NOW()
    ),
    (
        '50000000-0000-0000-0000-000000000002',
        'evt_2',
        'invoice.payment_failed',
        'processed',
        NOW()
    ),
    (
        '50000000-0000-0000-0000-000000000003',
        'evt_3',
        'customer.subscription.created',
        'processed',
        NOW()
    ),
    (
        '50000000-0000-0000-0000-000000000004',
        'evt_4',
        'customer.subscription.deleted',
        'pending',
        NOW()
    ),
    (
        '50000000-0000-0000-0000-000000000005',
        'evt_5',
        'charge.succeeded',
        'processed',
        NOW()
    );

-- 11. audit_logs
INSERT INTO
    audit_logs (
        "id",
        "user_id",
        "action",
        "metadata",
        "ip_address",
        "created_at"
    )
VALUES (
        '60000000-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'LOGIN',
        '{"browser": "Chrome"}',
        '192.168.1.1',
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000002',
        '22222222-2222-2222-2222-222222222222',
        'UPDATE_PROFILE',
        '{"field": "bio"}',
        '192.168.1.2',
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000003',
        '33333333-3333-3333-3333-333333333333',
        'CREATE_EVENT',
        '{"event_id": "2...0002"}',
        '192.168.1.3',
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000004',
        '44444444-4444-4444-4444-444444444444',
        'DELETE_MIX_TAPE',
        '{"mix_tape_id": "xxx"}',
        '192.168.1.4',
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000005',
        '55555555-5555-5555-5555-555555555555',
        'LOGOUT',
        '{}',
        '192.168.1.5',
        NOW()
    );

-- 12. support_tickets
INSERT INTO
    support_tickets (
        "id",
        "user_id",
        "full_name",
        "email",
        "subject",
        "issue",
        "status",
        "created_at"
    )
VALUES (
        '70000000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        'John Doe',
        'john@example.com',
        'Billing Issue',
        'Double charged',
        'open',
        NOW()
    ),
    (
        '70000000-0000-0000-0000-000000000002',
        '33333333-3333-3333-3333-333333333333',
        'Jane Smith',
        'jane@example.com',
        'Theme Bug',
        'Dark mode not working',
        'in_progress',
        NOW()
    ),
    (
        '70000000-0000-0000-0000-000000000003',
        '44444444-4444-4444-4444-444444444444',
        'Mike Johnson',
        'mike@example.com',
        'Login Problem',
        'Cannot reset password',
        'resolved',
        NOW()
    ),
    (
        '70000000-0000-0000-0000-000000000004',
        '55555555-5555-5555-5555-555555555555',
        'Sarah Williams',
        'sarah@example.com',
        'Feature Request',
        'Add custom fonts',
        'open',
        NOW()
    ),
    (
        '70000000-0000-0000-0000-000000000005',
        '11111111-1111-1111-1111-111111111111',
        'Admin Super',
        'admin@example.com',
        'System Test',
        'Testing tickets',
        'resolved',
        NOW()
    );

-- 13. notifications
INSERT INTO
    notifications (
        "id",
        "user_id",
        "title",
        "message",
        "type",
        "is_read",
        "created_at"
    )
VALUES (
        '80000000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        'New Booking',
        'You have a new booking request',
        'booking_request',
        false,
        NOW()
    ),
    (
        '80000000-0000-0000-0000-000000000002',
        '33333333-3333-3333-3333-333333333333',
        'Payment Received',
        'Invoice 400...2 paid',
        'payment',
        true,
        NOW()
    ),
    (
        '80000000-0000-0000-0000-000000000003',
        '44444444-4444-4444-4444-444444444444',
        'System Maintenance',
        'Downtime scheduled',
        'system',
        false,
        NOW()
    ),
    (
        '80000000-0000-0000-0000-000000000004',
        '55555555-5555-5555-5555-555555555555',
        'Subscription Renewed',
        'Plan upgraded',
        'payment',
        true,
        NOW()
    ),
    (
        '80000000-0000-0000-0000-000000000005',
        '11111111-1111-1111-1111-111111111111',
        'Admin Alert',
        'High traffic detected',
        'system',
        false,
        NOW()
    );

-- 14. landing_page_heroes
INSERT INTO
    landing_page_heroes (
        "id",
        "title",
        "description",
        "image_url",
        "is_active"
    )
VALUES (
        1,
        'Empower Your DJ Career',
        'Best platform for DJs',
        'hero1.png',
        true
    ),
    (
        2,
        'Connect with Fans',
        'Grow your audience',
        'hero2.png',
        false
    ),
    (
        3,
        'Manage Bookings',
        'All-in-one tool',
        'hero3.png',
        false
    ),
    (
        4,
        'Custom Themes',
        'Stand out online',
        'hero4.png',
        false
    ),
    (
        5,
        'Join Now',
        'Start for free today',
        'hero5.png',
        false
    );

-- 15. landing_page_steps
INSERT INTO
    landing_page_steps (
        "id",
        "title",
        "description",
        "image_url",
        "order"
    )
VALUES (
        1,
        'Sign Up',
        'Create your account',
        'step1.png',
        1
    ),
    (
        2,
        'Customize',
        'Pick a theme',
        'step2.png',
        2
    ),
    (
        3,
        'Add Mixes',
        'Upload your music',
        'step3.png',
        3
    ),
    (
        4,
        'Get Booked',
        'Receive requests',
        'step4.png',
        4
    ),
    (
        5,
        'Get Paid',
        'Earn money',
        'step5.png',
        5
    );

-- 16. landing_page_services
INSERT INTO
    landing_page_services (
        "id",
        "title",
        "description",
        "image_url",
        "order"
    )
VALUES (
        1,
        'Booking Management',
        'Manage all requests easily',
        'service1.png',
        1
    ),
    (
        2,
        'Portfolio Hosting',
        'Showcase your work',
        'service2.png',
        2
    ),
    (
        3,
        'Payment Processing',
        'Secure transactions',
        'service3.png',
        3
    ),
    (
        4,
        'Custom Domains',
        'Use your own URL',
        'service4.png',
        4
    ),
    (
        5,
        'Analytics',
        'Track your growth',
        'service5.png',
        5
    );

-- 17. landing_page_faqs
INSERT INTO
    landing_page_faqs (
        "id",
        "question",
        "answer",
        "order"
    )
VALUES (
        1,
        'Is it free?',
        'Yes, we have a free tier.',
        1
    ),
    (
        2,
        'Can I use my own domain?',
        'Yes, on Pro plans.',
        2
    ),
    (
        3,
        'How do I get paid?',
        'Via Stripe integration.',
        3
    ),
    (
        4,
        'Are there limits?',
        'Depends on your plan.',
        4
    ),
    (
        5,
        'Can I cancel anytime?',
        'Yes, no lock-in contracts.',
        5
    );

-- 18. landing_page_marquees
INSERT INTO
    landing_page_marquees ("id", "image_url", "order")
VALUES (1, 'marquee1.png', 1),
    (2, 'marquee2.png', 2),
    (3, 'marquee3.png', 3),
    (4, 'marquee4.png', 4),
    (5, 'marquee5.png', 5);