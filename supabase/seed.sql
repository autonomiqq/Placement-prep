-- Sample tests for development
-- Run after migrations

-- Aptitude test
insert into tests (title, description, category, difficulty, duration_mins, total_marks, passing_marks, is_published, tags)
values
  (
    'Quantitative Aptitude - Basics',
    'Covers number systems, percentages, ratios, and time-work problems. Ideal for TCS, Infosys, and Wipro preparation.',
    'aptitude', 'easy', 30, 20, 12, true,
    ARRAY['number-system', 'percentage', 'ratio', 'tcs', 'infosys']
  ),
  (
    'Verbal Reasoning - Comprehension',
    'Reading comprehension, sentence correction, and vocabulary questions based on Amcat and eLitmus patterns.',
    'verbal', 'medium', 25, 15, 9, true,
    ARRAY['comprehension', 'grammar', 'vocabulary', 'amcat']
  ),
  (
    'Data Structures & Algorithms',
    'Arrays, linked lists, trees, graphs, sorting and searching — core CS fundamentals for coding interviews.',
    'technical', 'hard', 45, 30, 18, true,
    ARRAY['dsa', 'arrays', 'trees', 'graphs', 'google', 'amazon']
  ),
  (
    'Coding Challenge - Python',
    'Solve real coding problems using Python. Focus on string manipulation, arrays, and dynamic programming.',
    'coding', 'medium', 60, 40, 24, true,
    ARRAY['python', 'dynamic-programming', 'strings']
  );
