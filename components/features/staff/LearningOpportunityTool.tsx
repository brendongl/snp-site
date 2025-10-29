'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GraduationCap, Users } from 'lucide-react';

interface Game {
  id: string;
  name: string;
  min_playtime: number;
}

interface StaffKnowledge {
  staffMemberId: string;
  gameName: string;
  confidenceLevel: string;
  canTeach: boolean;
}

interface Staff {
  id: string;
  name: string;
}

interface Opportunity {
  game: Game;
  teacher: Staff;
  learners: Staff[];
  learnerCount: number;
  teachingTime: number;
}

export default function LearningOpportunityTool() {
  const [games, setGames] = useState<Game[]>([]);
  const [knowledge, setKnowledge] = useState<StaffKnowledge[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [timeTier, setTimeTier] = useState<'quick' | 'medium' | 'long'>('quick');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [gamesRes, knowledgeRes, staffRes] = await Promise.all([
        fetch('/api/games'),
        fetch('/api/staff-knowledge'),
        fetch('/api/staff-list'),
      ]);

      if (gamesRes.ok) {
        const gamesData = await gamesRes.json();
        setGames(gamesData.games || []);
      }

      if (knowledgeRes.ok) {
        const knowledgeData = await knowledgeRes.json();
        setKnowledge(knowledgeData.knowledge || []);
      }

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaffList(staffData.staff || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStaff = (staffId: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  const findOpportunities = () => {
    console.log('=== Finding Opportunities ===');
    console.log('Selected staff:', selectedStaff);
    console.log('Time tier:', timeTier);
    console.log('Total games:', games.length);
    console.log('Total knowledge records:', knowledge.length);

    // Time thresholds (in minutes)
    const timeThresholds = {
      quick: 20,
      medium: 45,
      long: 999,
    };

    // Filter games by time tier
    const eligibleGames = games.filter(
      (game) => game.min_playtime <= timeThresholds[timeTier]
    );

    console.log('Eligible games after time filter:', eligibleGames.length);

    // For each game, find teachers and learners
    const opportunitiesList: Opportunity[] = [];

    eligibleGames.forEach((game, idx) => {
      // Find teachers: selected staff who can teach this game
      const teachers = selectedStaff
        .map((staffId) => {
          const staffMember = staffList.find((s) => s.id === staffId);
          const knowledgeRecord = knowledge.find(
            (k) =>
              k.staffMemberId === staffId &&
              k.gameName === game.name &&
              k.canTeach === true
          );
          return knowledgeRecord && staffMember
            ? { staff: staffMember, confidence: knowledgeRecord.confidenceLevel }
            : null;
        })
        .filter(Boolean);

      // Find learners: selected staff with no knowledge or confidence < Intermediate
      const learners = selectedStaff
        .map((staffId) => {
          const staffMember = staffList.find((s) => s.id === staffId);
          const knowledgeRecord = knowledge.find(
            (k) => k.staffMemberId === staffId && k.gameName === game.name
          );

          // Include if: no knowledge record OR confidence is Beginner/Intermediate
          const isLearner = !knowledgeRecord ||
            knowledgeRecord.confidenceLevel === 'Beginner' ||
            knowledgeRecord.confidenceLevel === 'Intermediate';

          return isLearner && staffMember ? staffMember : null;
        })
        .filter(Boolean) as Staff[];

      // Debug first few games
      if (idx < 3) {
        console.log(`Game: ${game.name}, Teachers: ${teachers.length}, Learners: ${learners.length}`);
      }

      // Only include if we have at least 1 teacher and 1 learner
      if (teachers.length > 0 && learners.length > 0) {
        // Pick the teacher with highest confidence (prioritize Instructor > Expert)
        const primaryTeacher = teachers.sort((a, b) => {
          const confidenceOrder = { Instructor: 4, Expert: 3, Intermediate: 2, Beginner: 1 };
          return (confidenceOrder[b!.confidence as keyof typeof confidenceOrder] || 0) -
                 (confidenceOrder[a!.confidence as keyof typeof confidenceOrder] || 0);
        })[0]!.staff;

        opportunitiesList.push({
          game,
          teacher: primaryTeacher,
          learners,
          learnerCount: learners.length,
          teachingTime: Math.ceil(game.min_playtime * 1.5),
        });
      }
    });

    // Sort by learner count (most learners first)
    const sortedOpportunities = opportunitiesList
      .sort((a, b) => b.learnerCount - a.learnerCount)
      .slice(0, 10);

    console.log('Total opportunities found:', opportunitiesList.length);
    console.log('Top 10 opportunities:', sortedOpportunities);

    setOpportunities(sortedOpportunities);
    setHasSearched(true);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Learning Opportunity Tool</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  const canSearch = selectedStaff.length >= 2;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-semibold">Learning Opportunity Tool</h2>
      </div>

      {/* Staff Selector */}
      <div className="mb-4">
        <label className="text-sm font-medium mb-2 block">
          Who's working today?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {staffList.map((staff) => (
            <div key={staff.id} className="flex items-center gap-2">
              <Checkbox
                id={`staff-${staff.id}`}
                checked={selectedStaff.includes(staff.id)}
                onCheckedChange={() => toggleStaff(staff.id)}
              />
              <label
                htmlFor={`staff-${staff.id}`}
                className="text-sm cursor-pointer"
              >
                {staff.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Time Filter */}
      <div className="mb-4">
        <label className="text-sm font-medium mb-2 block">
          Available time:
        </label>
        <Select value={timeTier} onValueChange={(val) => setTimeTier(val as any)}>
          <SelectTrigger className="w-full sm:w-[250px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="quick">Quick (0-20 min)</SelectItem>
            <SelectItem value="medium">Medium (20-45 min)</SelectItem>
            <SelectItem value="long">Long (45+ min)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Find Button */}
      <Button
        onClick={findOpportunities}
        disabled={!canSearch}
        className="w-full sm:w-auto"
        title={
          !canSearch
            ? 'Select at least 2 staff members (1 teacher + 1 learner)'
            : ''
        }
      >
        Find Learning Opportunities
      </Button>

      {/* Results */}
      {hasSearched && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">
              Suggested Training Sessions ({opportunities.length} results)
            </h3>
          </div>

          {opportunities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">No matches found.</p>
              <p className="text-sm">
                Try selecting more staff or a longer time window.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Tip: Select staff with different skill levels to find teaching
                opportunities
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {opportunities.map((opp, index) => (
                <Card key={`${opp.game.id}-${index}`} className="p-4 border-l-4 border-l-purple-500">
                  <div className="mb-2">
                    <h4 className="font-semibold">
                      {opp.game.name}
                      <span className="text-sm text-gray-600 ml-2">
                        ({opp.game.min_playtime} min → ~{opp.teachingTime} min
                        to teach)
                      </span>
                    </h4>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Teacher:</span>
                      <span>{opp.teacher.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">Can learn:</span>
                      <span>
                        {opp.learners.map((l) => l.name).join(', ')}
                        <span className="ml-1 text-gray-500">
                          ({opp.learnerCount} learner{opp.learnerCount !== 1 ? 's' : ''})
                        </span>
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
