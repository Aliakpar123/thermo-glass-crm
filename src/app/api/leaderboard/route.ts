import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    // Only members of the active company (non-admin)
    const users = await sql`
      SELECT u.id, u.name, u.role
      FROM users u
      JOIN user_companies uc ON uc.user_id = u.id
      WHERE uc.company_id = ${companyId} AND u.role != 'admin'
    `;

    const stats = await Promise.all(
      users.map(async (user) => {
        let dealsCreated, completed, commentsCount, statusChanges, tasksCompleted;

        if (period === 'month') {
          [dealsCreated, completed, commentsCount, statusChanges, tasksCompleted] = await Promise.all([
            sql`SELECT COUNT(*)::int as c FROM orders WHERE manager_id = ${user.id} AND company_id = ${companyId} AND created_at >= date_trunc('month', NOW())`,
            sql`SELECT COUNT(*)::int as c FROM orders WHERE manager_id = ${user.id} AND company_id = ${companyId} AND status = 'completed' AND updated_at >= date_trunc('month', NOW())`,
            sql`SELECT COUNT(*)::int as c FROM client_comments cc JOIN clients cl ON cc.client_id = cl.id WHERE cc.user_id = ${user.id} AND cl.company_id = ${companyId} AND cc.created_at >= date_trunc('month', NOW())`,
            sql`SELECT COUNT(*)::int as c FROM order_history oh JOIN orders o ON oh.order_id = o.id WHERE oh.changed_by = ${user.id} AND o.company_id = ${companyId} AND oh.created_at >= date_trunc('month', NOW())`,
            sql`SELECT COUNT(*)::int as c FROM tasks WHERE assigned_to = ${user.id} AND company_id = ${companyId} AND status = 'completed' AND completed_at >= date_trunc('month', NOW())`,
          ]);
        } else if (period === 'week') {
          [dealsCreated, completed, commentsCount, statusChanges, tasksCompleted] = await Promise.all([
            sql`SELECT COUNT(*)::int as c FROM orders WHERE manager_id = ${user.id} AND company_id = ${companyId} AND created_at >= NOW() - INTERVAL '7 days'`,
            sql`SELECT COUNT(*)::int as c FROM orders WHERE manager_id = ${user.id} AND company_id = ${companyId} AND status = 'completed' AND updated_at >= NOW() - INTERVAL '7 days'`,
            sql`SELECT COUNT(*)::int as c FROM client_comments cc JOIN clients cl ON cc.client_id = cl.id WHERE cc.user_id = ${user.id} AND cl.company_id = ${companyId} AND cc.created_at >= NOW() - INTERVAL '7 days'`,
            sql`SELECT COUNT(*)::int as c FROM order_history oh JOIN orders o ON oh.order_id = o.id WHERE oh.changed_by = ${user.id} AND o.company_id = ${companyId} AND oh.created_at >= NOW() - INTERVAL '7 days'`,
            sql`SELECT COUNT(*)::int as c FROM tasks WHERE assigned_to = ${user.id} AND company_id = ${companyId} AND status = 'completed' AND completed_at >= NOW() - INTERVAL '7 days'`,
          ]);
        } else {
          [dealsCreated, completed, commentsCount, statusChanges, tasksCompleted] = await Promise.all([
            sql`SELECT COUNT(*)::int as c FROM orders WHERE manager_id = ${user.id} AND company_id = ${companyId}`,
            sql`SELECT COUNT(*)::int as c FROM orders WHERE manager_id = ${user.id} AND company_id = ${companyId} AND status = 'completed'`,
            sql`SELECT COUNT(*)::int as c FROM client_comments cc JOIN clients cl ON cc.client_id = cl.id WHERE cc.user_id = ${user.id} AND cl.company_id = ${companyId}`,
            sql`SELECT COUNT(*)::int as c FROM order_history oh JOIN orders o ON oh.order_id = o.id WHERE oh.changed_by = ${user.id} AND o.company_id = ${companyId}`,
            sql`SELECT COUNT(*)::int as c FROM tasks WHERE assigned_to = ${user.id} AND company_id = ${companyId} AND status = 'completed'`,
          ]);
        }

        const deals = dealsCreated[0]?.c || 0;
        const comp = completed[0]?.c || 0;
        const comments = commentsCount[0]?.c || 0;
        const changes = statusChanges[0]?.c || 0;
        const tasks = tasksCompleted[0]?.c || 0;

        const points = (deals * 10) + (changes * 5) + (comp * 100) + (comments * 3) + (tasks * 5);

        let level = 'Новичок';
        let levelEmoji = '🌱';
        if (points >= 1000) { level = 'Легенда'; levelEmoji = '👑'; }
        else if (points >= 500) { level = 'Мастер'; levelEmoji = '🏆'; }
        else if (points >= 200) { level = 'Эксперт'; levelEmoji = '⭐'; }
        else if (points >= 100) { level = 'Профи'; levelEmoji = '🔥'; }
        else if (points >= 50) { level = 'Активный'; levelEmoji = '💪'; }

        // Next level threshold
        let nextLevel = 50;
        if (points >= 1000) nextLevel = points; // already max
        else if (points >= 500) nextLevel = 1000;
        else if (points >= 200) nextLevel = 500;
        else if (points >= 100) nextLevel = 200;
        else if (points >= 50) nextLevel = 100;

        // Achievements
        const achievements: { id: string; name: string; emoji: string; earned: boolean }[] = [];

        // First deal closed
        const totalCompleted = await sql`SELECT COUNT(*)::int as c FROM orders WHERE manager_id = ${user.id} AND company_id = ${companyId} AND status = 'completed'`;
        achievements.push({
          id: 'first_deal',
          name: 'Первая сделка',
          emoji: '🎯',
          earned: (totalCompleted[0]?.c || 0) >= 1,
        });

        // 5 deals in a week
        const weekDeals = await sql`SELECT COUNT(*)::int as c FROM orders WHERE manager_id = ${user.id} AND company_id = ${companyId} AND created_at >= NOW() - INTERVAL '7 days'`;
        achievements.push({
          id: 'on_fire',
          name: 'На огне',
          emoji: '🔥',
          earned: (weekDeals[0]?.c || 0) >= 5,
        });

        // 50 comments total
        const totalComments = await sql`SELECT COUNT(*)::int as c FROM client_comments cc JOIN clients cl ON cc.client_id = cl.id WHERE cc.user_id = ${user.id} AND cl.company_id = ${companyId}`;
        achievements.push({
          id: 'communicator',
          name: 'Коммуникатор',
          emoji: '💬',
          earned: (totalComments[0]?.c || 0) >= 50,
        });

        // Closed a deal within 3 days
        const fastDeal = await sql`SELECT COUNT(*)::int as c FROM orders WHERE manager_id = ${user.id} AND company_id = ${companyId} AND status = 'completed' AND updated_at - created_at <= INTERVAL '3 days'`;
        achievements.push({
          id: 'sprinter',
          name: 'Спринтер',
          emoji: '🏃',
          earned: (fastDeal[0]?.c || 0) >= 1,
        });

        return {
          id: user.id,
          name: user.name,
          role: user.role,
          points,
          level,
          levelEmoji,
          nextLevel,
          stats: {
            deals_created: deals,
            deals_completed: comp,
            comments,
            status_changes: changes,
            tasks_completed: tasks,
          },
          achievements,
        };
      })
    );

    // Sort by points descending
    stats.sort((a, b) => b.points - a.points);

    // Check "Manager of the month" achievement for top scorer
    if (stats.length > 0 && stats[0].points > 0) {
      stats[0].achievements.push({
        id: 'manager_of_month',
        name: 'Менеджер месяца',
        emoji: '👑',
        earned: true,
      });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
