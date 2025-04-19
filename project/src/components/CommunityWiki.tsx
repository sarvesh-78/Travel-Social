import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useParams } from "react-router-dom";

const SECTIONS = [
  "best_time_to_visit",
  "safety",
  "most_efficient_local_transport",
  "question_of_the_week",
];

type WikiEntry = {
  id: string;
  section: string;
  content: string;
  poll_question: string | null;
  poll_answers: string[] | null;
  poll_votes: { [key: string]: number } | null;
  profile_id: string;
};

type Props = {
  cityId: string;
};

const CommunityWiki = () => {
  const { cityId } = useParams<{ cityId: string }>();
  const [wikiData, setWikiData] = useState<Record<string, WikiEntry | null>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!cityId) {
        console.error("City ID is undefined");
        return;
      }

      const { data, error } = await supabase
        .from("community_wiki")
        .select("*")
        .eq("city_id", cityId);

      if (error) {
        console.error("Error fetching wiki:", error);
        return;
      }


      const map: Record<string, WikiEntry | null> = {};
      for (const section of SECTIONS) {
        const entry = data?.find((d) => d.section === section) || null;
        map[section] = entry;
      }
      setWikiData(map);
    };

    fetchData();
  }, [cityId]);

  const handleVote = async (section: string, choice: string) => {
    const entry = wikiData[section];
    if (!entry || !entry.poll_votes || !entry.poll_answers?.includes(choice)) return;

    const updatedVotes = { ...entry.poll_votes };
    updatedVotes[choice] = (updatedVotes[choice] || 0) + 1;

    const { error } = await supabase
      .from("community_wiki")
      .update({ poll_votes: updatedVotes })
      .eq("id", entry.id);

    if (error) console.error("Vote error:", error);
    else window.location.reload(); // Could replace with optimistic update
  };

  if (!cityId) {
    return <div>City ID is missing. Please select a city.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">🌐 Community Wiki</h2>

      {SECTIONS.map((section) => {
        const entry = wikiData[section];

        return (
          <div key={section} className="mb-8 border-b pb-6">
            <h3 className="text-xl font-semibold capitalize mb-2">
              {section.replace(/_/g, " ")}
            </h3>

            <p className="mt-2 text-gray-800 whitespace-pre-line">
              {entry?.content || "No information available yet."}
            </p>

            {/* Poll UI */}
            {entry?.poll_question && (
              <div className="mt-6">
                <h4 className="font-medium text-lg mb-4">{entry.poll_question}</h4>
                {entry.poll_answers?.map((choice) => (
                  <div
                    key={choice}
                    className="flex items-center justify-between p-3 mb-3 bg-gray-100 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                  >
                    <span className="text-gray-800 font-medium">{choice}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-600 text-sm">
                        {entry.poll_votes?.[choice] || 0} votes
                      </span>
                      <button
                        className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                        onClick={() => handleVote(section, choice)}
                      >
                        Vote
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CommunityWiki;
