require('dotenv').config({ path: '.env.local' });
const supabase = require('./lib/supabase-server');

async function testConnection() {
  console.log('🔌 Testing Supabase connection...\n');

  try {
    console.log('📝 Testing INSERT...');
    const { data: insertData, error: insertError } = await supabase
      .from('respuestas_cajeras')
      .insert([{
        cajera: 'TEST',
        caja: 'Caja 1',
        tc: 475,
        c_20000: 1
      }])
      .select();

    if (insertError) {
      console.error('❌ INSERT error:', insertError.message);
      console.log('\n⚠️  Make sure the table exists. Run:');
      console.log('   npx supabase link && npx supabase push');
      return;
    }
    console.log('✅ INSERT successful:', insertData);

    console.log('\n📖 Testing SELECT...');
    const { data: selectData, error: selectError } = await supabase
      .from('respuestas_cajeras')
      .select('*')
      .limit(5);

    if (selectError) {
      console.error('❌ SELECT error:', selectError.message);
      return;
    }
    console.log('✅ SELECT successful. Records found:', selectData.length);
    if (selectData.length > 0) {
      console.log('Sample:', selectData[0]);
    }

    console.log('\n✅ Supabase is connected!');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

testConnection();
