Next Steps

  1. Replace env var placeholders  
  in frontend/.env.local with your 
  real Stripe keys
  2. Run the migration against your
   Supabase project: supabase db   
  push or paste the SQL in the     
  Supabase dashboard
  3. Test locally with Stripe CLI: 
  stripe listen --forward-to       
  localhost:3000/api/stripe/webhook
  4. In Sanity Studio: toggle      
  "Enable In-App Registration" on  
  an event and set an entryFee     
  5. Production webhook: register  
  https://yourdomain.com/api/stripe
  /webhook in Stripe Dashboard     
  subscribing to
  checkout.session.completed,      
  checkout.session.expired,        
  charge.refunded