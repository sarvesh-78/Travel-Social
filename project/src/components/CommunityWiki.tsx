import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useParams } from "react-router-dom";

const SECTIONS = [
  "best_time_to_visit",
  "safety",
  "most_efficient_local_transport",
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

      console.log("City ID:", cityId);

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
      <h2 className="text-xl font-bold mb-4">🌐 Community Wiki</h2>

      {SECTIONS.map((section) => {
        const entry = wikiData[section];

        return (
          <div key={section} className="mb-6 border-b pb-4">
            <h3 className="text-lg font-semibold capitalize">
              {section.replace(/_/g, " ")}
            </h3>

            <p className="mt-2 text-gray-800 whitespace-pre-line">
              {entry?.content || "No information available yet."}
            </p>

            {/* Poll UI */}
            {entry?.poll_question && (
              <div className="mt-4">
                <h4 className="font-medium">{entry.poll_question}</h4>
                {entry.poll_answers?.map((choice) => (
                  <div
                    key={choice}
                    className="flex items-center justify-between mt-1"
                  >
                    <span>{choice}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">
                        {entry.poll_votes?.[choice] || 0} votes
                      </span>
                      <button
                        className="text-sm bg-gray-200 px-2 py-1 rounded"
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
