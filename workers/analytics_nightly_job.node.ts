// Nightly Analytics Job Worker - Node.js Version
// Computes SKU-level trends, top complaints, NPS metrics, and generates CSVs

import { createClient } from '@supabase/supabase-js';
import { createObjectCsvWriter } from 'csv-writer';
import { promises as fs } from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STORAGE_BUCKET = process.env.REPORTS_STORAGE_BUCKET || 'reports';
const OUTPUT_DIR = process.env.OUTPUT_DIR || './reports_output';

// Ensure output directory exists
async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating output directory:', error);
  }
}

// Generate daily analytics snapshot for all retailers
async function generateDailySnapshots(targetDate: Date = new Date()) {
  console.log(`Generating daily snapshots for ${targetDate.toISOString().split('T')[0]}`);
  
  const dateStr = targetDate.toISOString().split('T')[0];
  
  // Get all retailers (users with role 'retailer' or 'wholesaler')
  const { data: retailers, error: retailersError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('role', ['retailer', 'wholesaler']);
  
  if (retailersError) {
    console.error('Error fetching retailers:', retailersError);
    return [];
  }
  
  console.log(`Found ${retailers?.length || 0} retailers to process`);
  
  const results = [];
  for (const retailer of retailers || []) {
    try {
      console.log(`Processing retailer: ${retailer.email}`);
      
      // Generate daily analytics snapshot
      const { data: snapshotId, error: snapshotError } = await supabase
        .rpc('generate_daily_analytics_snapshot', {
          p_retailer_id: retailer.id,
          p_snapshot_date: dateStr
        });
      
      if (snapshotError) {
        console.error(`Error generating snapshot for ${retailer.email}:`, snapshotError);
        results.push({ retailer: retailer.email, success: false, error: snapshotError.message });
        continue;
      }
      
      // Generate SKU trends
      const { data: trendsCount, error: trendsError } = await supabase
        .rpc('generate_sku_trends', {
          p_retailer_id: retailer.id,
          p_trend_date: dateStr
        });
      
      if (trendsError) {
        console.error(`Error generating SKU trends for ${retailer.email}:`, trendsError);
      }
      
      results.push({
        retailer: retailer.email,
        success: true,
        snapshotId,
        trendsGenerated: trendsCount || 0
      });
      
      console.log(`✓ Completed: ${retailer.email} (${trendsCount || 0} SKUs)`);
    } catch (error: any) {
      console.error(`Fatal error processing ${retailer.email}:`, error);
      results.push({ retailer: retailer.email, success: false, error: error.message });
    }
  }
  
  return results;
}

// Generate weekly complaint analysis
async function generateWeeklyComplaints() {
  console.log('Generating weekly complaint analysis');
  
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  
  const { data: retailers, error } = await supabase
    .from('profiles')
    .select('id, email')
    .in('role', ['retailer', 'wholesaler']);
  
  if (error) {
    console.error('Error fetching retailers:', error);
    return [];
  }
  
  const results = [];
  for (const retailer of retailers || []) {
    try {
      const { data: complaintId, error: complaintError } = await supabase
        .rpc('analyze_retailer_complaints', {
          p_retailer_id: retailer.id,
          p_period_start: startDate.toISOString().split('T')[0],
          p_period_end: endDate.toISOString().split('T')[0]
        });
      
      if (complaintError) {
        console.error(`Error analyzing complaints for ${retailer.email}:`, complaintError);
        continue;
      }
      
      results.push({ retailer: retailer.email, complaintId });
    } catch (error: any) {
      console.error(`Error processing complaints for ${retailer.email}:`, error);
    }
  }
  
  return results;
}

// Generate CSV export for retailer analytics
async function generateAnalyticsCSV(
  retailerId: string,
  startDate: string,
  endDate: string,
  reportType: 'summary' | 'sku_trends' | 'complaints' = 'summary'
): Promise<string | null> {
  await ensureOutputDir();
  
  const filename = `${reportType}_${retailerId}_${startDate}_${endDate}.csv`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  try {
    if (reportType === 'summary') {
      // Daily snapshots CSV
      const { data: snapshots, error } = await supabase
        .from('analytics_snapshots')
        .select('*')
        .eq('retailer_id', retailerId)
        .gte('snapshot_date', startDate)
        .lte('snapshot_date', endDate)
        .order('snapshot_date', { ascending: true });
      
      if (error) throw error;
      
      const csvWriter = createObjectCsvWriter({
        path: filepath,
        header: [
          { id: 'snapshot_date', title: 'Date' },
          { id: 'total_orders', title: 'Total Orders' },
          { id: 'total_revenue', title: 'Total Revenue' },
          { id: 'total_reviews', title: 'Total Reviews' },
          { id: 'avg_rating', title: 'Average Rating' },
          { id: 'nps_score', title: 'NPS Score' },
          { id: 'promoters_count', title: 'Promoters (5★)' },
          { id: 'passives_count', title: 'Passives (3-4★)' },
          { id: 'detractors_count', title: 'Detractors (1-2★)' },
          { id: 'total_products', title: 'Total Products' },
          { id: 'active_products', title: 'Active Products' }
        ]
      });
      
      await csvWriter.writeRecords(snapshots || []);
      
    } else if (reportType === 'sku_trends') {
      // SKU trends CSV
      const { data: trends, error } = await supabase
        .from('sku_trends')
        .select(`
          trend_date,
          product_id,
          products(name, sku),
          units_sold,
          revenue,
          reviews_count,
          avg_rating,
          rating_trend,
          complaints_count,
          current_stock
        `)
        .eq('retailer_id', retailerId)
        .gte('trend_date', startDate)
        .lte('trend_date', endDate)
        .order('trend_date', { ascending: true })
        .order('revenue', { ascending: false });
      
      if (error) throw error;
      
      const formattedTrends = trends?.map(t => ({
        date: t.trend_date,
        product_name: (t.products as any)?.name || 'Unknown',
        sku: (t.products as any)?.sku || '',
        units_sold: t.units_sold,
        revenue: t.revenue,
        reviews: t.reviews_count,
        avg_rating: t.avg_rating,
        rating_trend: t.rating_trend,
        complaints: t.complaints_count,
        stock: t.current_stock
      }));
      
      const csvWriter = createObjectCsvWriter({
        path: filepath,
        header: [
          { id: 'date', title: 'Date' },
          { id: 'product_name', title: 'Product Name' },
          { id: 'sku', title: 'SKU' },
          { id: 'units_sold', title: 'Units Sold' },
          { id: 'revenue', title: 'Revenue' },
          { id: 'reviews', title: 'Reviews' },
          { id: 'avg_rating', title: 'Avg Rating' },
          { id: 'rating_trend', title: 'Rating Trend' },
          { id: 'complaints', title: 'Complaints' },
          { id: 'stock', title: 'Current Stock' }
        ]
      });
      
      await csvWriter.writeRecords(formattedTrends || []);
      
    } else if (reportType === 'complaints') {
      // Complaints CSV
      const { data: complaints, error } = await supabase
        .from('retailer_complaints')
        .select('*')
        .eq('retailer_id', retailerId)
        .gte('period_start', startDate)
        .lte('period_end', endDate)
        .order('period_start', { ascending: true });
      
      if (error) throw error;
      
      const csvWriter = createObjectCsvWriter({
        path: filepath,
        header: [
          { id: 'period_start', title: 'Period Start' },
          { id: 'period_end', title: 'Period End' },
          { id: 'quality_issues', title: 'Quality Issues' },
          { id: 'delivery_issues', title: 'Delivery Issues' },
          { id: 'packaging_issues', title: 'Packaging Issues' },
          { id: 'price_issues', title: 'Price Issues' },
          { id: 'service_issues', title: 'Service Issues' },
          { id: 'other_issues', title: 'Other Issues' }
        ]
      });
      
      await csvWriter.writeRecords(complaints || []);
    }
    
    console.log(`✓ Generated CSV: ${filename}`);
    
    // Upload to Supabase Storage
    const fileContent = await fs.readFile(filepath);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`${retailerId}/${filename}`, fileContent, {
        contentType: 'text/csv',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Error uploading CSV:', uploadError);
      return filepath; // Return local path if upload fails
    }
    
    const { data: publicUrl } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(`${retailerId}/${filename}`);
    
    return publicUrl.publicUrl;
    
  } catch (error) {
    console.error(`Error generating CSV for ${retailerId}:`, error);
    return null;
  }
}

// Main nightly job
async function runNightlyJob() {
  console.log('=== Starting Nightly Analytics Job ===');
  console.log(`Time: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  
  try {
    // 1. Generate daily snapshots for all retailers
    console.log('\n1. Generating daily analytics snapshots...');
    const snapshotResults = await generateDailySnapshots();
    console.log(`✓ Completed: ${snapshotResults.filter(r => r.success).length}/${snapshotResults.length} retailers`);
    
    // 2. Generate weekly complaint analysis (run daily, uses 7-day window)
    console.log('\n2. Generating weekly complaint analysis...');
    const complaintResults = await generateWeeklyComplaints();
    console.log(`✓ Completed: ${complaintResults.length} retailers analyzed`);
    
    // 3. Generate CSV exports for retailers who want them
    console.log('\n3. Generating scheduled CSV reports...');
    const { data: scheduledReports, error: reportsError } = await supabase
      .from('scheduled_reports')
      .select('*, profiles(email)')
      .eq('status', 'pending')
      .lte('next_generation_at', new Date().toISOString());
    
    if (!reportsError && scheduledReports) {
      for (const report of scheduledReports) {
        try {
          // Update status to generating
          await supabase
            .from('scheduled_reports')
            .update({ status: 'generating' })
            .eq('id', report.id);
          
          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - (report.report_frequency === 'daily' ? 1 : report.report_frequency === 'weekly' ? 7 : 30));
          const startDateStr = startDate.toISOString().split('T')[0];
          
          // Generate CSVs
          const summaryUrl = await generateAnalyticsCSV(report.retailer_id, startDateStr, endDate, 'summary');
          const skuUrl = report.include_sku_trends ? await generateAnalyticsCSV(report.retailer_id, startDateStr, endDate, 'sku_trends') : null;
          const complaintsUrl = report.include_complaints ? await generateAnalyticsCSV(report.retailer_id, startDateStr, endDate, 'complaints') : null;
          
          // Update report with CSV URLs
          await supabase
            .from('scheduled_reports')
            .update({
              status: 'completed',
              csv_url: summaryUrl,
              last_generated_at: new Date().toISOString()
            })
            .eq('id', report.id);
          
          // Schedule next report
          await supabase.rpc('schedule_next_report', { p_report_id: report.id });
          
          console.log(`✓ Generated report for ${(report.profiles as any)?.email}`);
        } catch (error: any) {
          console.error(`Error generating report ${report.id}:`, error);
          
          await supabase
            .from('scheduled_reports')
            .update({
              status: 'failed',
              error_message: error.message
            })
            .eq('id', report.id);
        }
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n=== Nightly Job Completed in ${duration}s ===`);
    
  } catch (error) {
    console.error('Fatal error in nightly job:', error);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('Analytics Nightly Job Worker (Node.js) started');
  
  const runOnce = process.env.ANALYTICS_RUN_ONCE === 'true';
  const interval = parseInt(process.env.ANALYTICS_INTERVAL_MS || '86400000'); // 24 hours
  
  if (runOnce) {
    console.log('Running once');
    await runNightlyJob();
    process.exit(0);
  } else {
    console.log(`Running in continuous mode (interval: ${interval}ms)`);
    
    // Run immediately
    await runNightlyJob();
    
    // Then run on schedule
    setInterval(async () => {
      await runNightlyJob();
    }, interval);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
